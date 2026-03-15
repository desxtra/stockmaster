require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const multer = require('multer');

// AWS SDK Clients
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'stockmaster_prod',
  user:     process.env.DB_USER     || 'stockmaster_admin',
  password: process.env.DB_PASSWORD || 'changeme',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};
const SNS_TOPIC_ARN  = process.env.SNS_TOPIC_ARN  || '';
const SQS_QUEUE_URL  = process.env.SQS_QUEUE_URL  || '';
const S3_BACKUP_BUCKET = process.env.S3_BACKUP_BUCKET || '';
const S3_STATIC_BUCKET = process.env.S3_STATIC_BUCKET || '';
const DYNAMO_TABLE   = process.env.DYNAMO_TABLE   || 'stockmaster-audit-log';

// ─── AWS CLIENTS ─────────────────────────────────────────────────────────────
const s3  = new S3Client({ region: AWS_REGION });
const sns = new SNSClient({ region: AWS_REGION });
const sqs = new SQSClient({ region: AWS_REGION });
const ddbRaw = new DynamoDBClient({ region: AWS_REGION });
const ddb = DynamoDBDocumentClient.from(ddbRaw);
const cw  = new CloudWatchClient({ region: AWS_REGION });

// ─── DATABASE POOL ───────────────────────────────────────────────────────────
const pool = new Pool(DB_CONFIG);
pool.on('error', (err) => console.error('Unexpected DB client error', err));

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Write an audit entry to DynamoDB */
async function auditLog(action, userId, details) {
  try {
    await ddb.send(new PutCommand({
      TableName: DYNAMO_TABLE,
      Item: {
        auditId:   uuidv4(),
        timestamp: Date.now(),
        action,
        userId:    userId || 'system',
        details:   JSON.stringify(details),
        createdAt: new Date().toISOString(),
      },
    }));
  } catch (e) {
    console.error('[AuditLog] DynamoDB error:', e.message);
  }
}

/** Publish a metric to CloudWatch */
async function pushMetric(metricName, value = 1, unit = 'Count') {
  try {
    await cw.send(new PutMetricDataCommand({
      Namespace: 'StockMaster/Custom',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
      }],
    }));
  } catch (e) {
    console.error('[CloudWatch] metric error:', e.message);
  }
}

/** Send message to SQS */
async function sendSQS(messageBody) {
  if (!SQS_QUEUE_URL) return;
  try {
    await sqs.send(new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
    }));
  } catch (e) {
    console.error('[SQS] send error:', e.message);
  }
}

/** Publish SNS alert */
async function sendSNS(subject, message) {
  if (!SNS_TOPIC_ARN) return;
  try {
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: subject,
      Message: message,
    }));
    await pushMetric('NotificationsSent');
  } catch (e) {
    console.error('[SNS] publish error:', e.message);
  }
}

/** Upload buffer/string to S3 */
async function uploadToS3(bucket, key, body, contentType = 'application/json') {
  if (!bucket) return null;
  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: typeof body === 'string' ? body : JSON.stringify(body),
      ContentType: contentType,
    }));
    return `s3://${bucket}/${key}`;
  } catch (e) {
    console.error('[S3] upload error:', e.message);
    return null;
  }
}

// ─── MULTER (local upload → EFS /uploads path or /tmp fallback) ──────────────
const uploadDir = process.env.EFS_UPLOAD_PATH || '/tmp/uploads';
const fs = require('fs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try { await pool.query('SELECT 1'); } catch (e) { dbStatus = 'error: ' + e.message; }
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    region: AWS_REGION,
  });
});

// ── Products ──────────────────────────────────────────────────────────────────

/** GET /api/products — list all products */
app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products ORDER BY created_at DESC'
    );
    await pushMetric('ProductsTracked', rows.length);
    res.json({ success: true, data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/** GET /api/products/:id — single product */
app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM products WHERE id = $1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** POST /api/products — create product */
app.post('/api/products', async (req, res) => {
  const { name, sku, description, category, price, stock_quantity, min_stock_level } = req.body;
  if (!name || !sku) return res.status(400).json({ success: false, error: 'name and sku required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (name, sku, description, category, price, stock_quantity, min_stock_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, sku, description || '', category || 'General', parseFloat(price) || 0,
       parseInt(stock_quantity) || 0, parseInt(min_stock_level) || 5]
    );
    const product = rows[0];
    await auditLog('CREATE_PRODUCT', 'system', product);
    await sendSQS({ event: 'PRODUCT_CREATED', productId: product.id, sku });
    await pushMetric('InventoryUpdateProcessed');
    res.status(201).json({ success: true, data: product });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ success: false, error: 'SKU already exists' });
    res.status(500).json({ success: false, error: e.message });
  }
});

/** PUT /api/products/:id — update product */
app.put('/api/products/:id', async (req, res) => {
  const { name, description, category, price, min_stock_level } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE products SET name=$1, description=$2, category=$3, price=$4,
       min_stock_level=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, description, category, parseFloat(price), parseInt(min_stock_level), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    await auditLog('UPDATE_PRODUCT', 'system', rows[0]);
    await pushMetric('InventoryUpdateProcessed');
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** DELETE /api/products/:id — delete product */
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM products WHERE id=$1 RETURNING *', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    await auditLog('DELETE_PRODUCT', 'system', { id: req.params.id });
    res.json({ success: true, message: 'Product deleted' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Inventory Adjustments ─────────────────────────────────────────────────────

/** POST /api/inventory/adjust — adjust stock */
app.post('/api/inventory/adjust', async (req, res) => {
  const { product_id, adjustment_type, quantity, notes } = req.body;
  if (!product_id || !adjustment_type || !quantity)
    return res.status(400).json({ success: false, error: 'product_id, adjustment_type, quantity required' });

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0)
    return res.status(400).json({ success: false, error: 'quantity must be a positive integer' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the product row
    const { rows: pRows } = await client.query(
      'SELECT * FROM products WHERE id=$1 FOR UPDATE', [product_id]
    );
    if (!pRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Product not found' }); }
    const product = pRows[0];

    // Calculate new stock
    let newStock = product.stock_quantity;
    if (adjustment_type === 'IN')  newStock += qty;
    if (adjustment_type === 'OUT') newStock -= qty;
    if (adjustment_type === 'SET') newStock  = qty;

    if (newStock < 0) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: 'Insufficient stock' }); }

    // Update product stock
    await client.query(
      'UPDATE products SET stock_quantity=$1, updated_at=NOW() WHERE id=$2',
      [newStock, product_id]
    );

    // Insert adjustment record
    const { rows: adjRows } = await client.query(
      `INSERT INTO inventory_adjustments (product_id, adjustment_type, quantity_before, quantity_after, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [product_id, adjustment_type, product.stock_quantity, newStock, notes || '']
    );
    await client.query('COMMIT');

    // Side effects (non-blocking)
    await auditLog('INVENTORY_ADJUST', 'system', adjRows[0]);
    await sendSQS({ event: 'INVENTORY_ADJUSTED', productId: product_id, type: adjustment_type, newStock });
    await pushMetric('InventoryUpdateProcessed');

    // Alert if below min level
    if (newStock <= product.min_stock_level) {
      await sendSNS(
        `[StockMaster] Low Stock Alert: ${product.name}`,
        `Product "${product.name}" (SKU: ${product.sku}) is low on stock.\nCurrent: ${newStock} | Min: ${product.min_stock_level}`
      );
    }

    res.json({ success: true, data: adjRows[0], newStock });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

/** GET /api/inventory/history — adjustment history */
app.get('/api/inventory/history', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ia.*, p.name AS product_name, p.sku
       FROM inventory_adjustments ia
       JOIN products p ON ia.product_id = p.id
       ORDER BY ia.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Reports ───────────────────────────────────────────────────────────────────

/** GET /api/reports/summary — inventory summary report */
app.get('/api/reports/summary', async (req, res) => {
  try {
    const [totals, lowStock, catBreakdown, recentAdj] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total_products,
                  SUM(stock_quantity) AS total_units,
                  SUM(price * stock_quantity) AS total_value
                  FROM products`),
      pool.query(`SELECT * FROM products WHERE stock_quantity <= min_stock_level ORDER BY stock_quantity ASC`),
      pool.query(`SELECT category, COUNT(*) AS count, SUM(stock_quantity) AS units
                  FROM products GROUP BY category ORDER BY units DESC`),
      pool.query(`SELECT ia.*, p.name, p.sku FROM inventory_adjustments ia
                  JOIN products p ON ia.product_id = p.id
                  ORDER BY ia.created_at DESC LIMIT 10`),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      summary: totals.rows[0],
      lowStockItems: lowStock.rows,
      categoryBreakdown: catBreakdown.rows,
      recentAdjustments: recentAdj.rows,
    };

    // Backup report to S3
    const s3Key = `reports/summary-${Date.now()}.json`;
    await uploadToS3(S3_BACKUP_BUCKET, s3Key, report);
    await pushMetric('AuditLogsCreated');

    res.json({ success: true, data: report });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Audit Logs ────────────────────────────────────────────────────────────────

/** GET /api/audit — fetch recent audit logs from DynamoDB */
app.get('/api/audit', async (req, res) => {
  try {
    const result = await ddb.send(new ScanCommand({
      TableName: DYNAMO_TABLE,
      Limit: 50,
    }));
    const items = (result.Items || []).sort((a, b) => b.timestamp - a.timestamp);
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── File Upload ───────────────────────────────────────────────────────────────

/** POST /api/upload — upload file to EFS + S3 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
  try {
    const fileContent = fs.readFileSync(req.file.path);
    const s3Key = `uploads/${Date.now()}-${req.file.originalname}`;
    const s3Url = await uploadToS3(S3_STATIC_BUCKET, s3Key, fileContent, req.file.mimetype);
    await auditLog('FILE_UPLOAD', 'system', { filename: req.file.originalname, s3Key, size: req.file.size });
    res.json({ success: true, data: { filename: req.file.filename, size: req.file.size, s3Url } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Notification Test ─────────────────────────────────────────────────────────

/** POST /api/notify — manual SNS notification trigger */
app.post('/api/notify', async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ success: false, error: 'subject and message required' });
  try {
    await sendSNS(subject, message);
    res.json({ success: true, message: 'Notification sent' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Serve SPA ────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[StockMaster] Server running on port ${PORT}`);
  console.log(`[StockMaster] Region: ${AWS_REGION}`);
  console.log(`[StockMaster] DB Host: ${DB_CONFIG.host}`);
});

module.exports = app;
