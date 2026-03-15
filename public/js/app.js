/* StockMaster — Frontend App JS */

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  async call(method, url, body) {
    showLoader(true);
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Request failed');
      return data;
    } finally {
      showLoader(false);
    }
  },
  get:    (url)       => api.call('GET', url),
  post:   (url, body) => api.call('POST', url, body),
  put:    (url, body) => api.call('PUT', url, body),
  delete: (url)       => api.call('DELETE', url),
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function showLoader(on) { document.getElementById('loader').style.display = on ? 'block' : 'none'; }

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = type;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

function fmtMoney(v) {
  return '$' + (parseFloat(v) || 0).toFixed(2);
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
const sections = {
  dashboard:     { el: 'sec-dashboard',    title: 'Dashboard',         load: loadDashboard },
  products:      { el: 'sec-products',     title: 'Products',          load: loadProducts },
  inventory:     { el: 'sec-inventory',    title: 'Inventory Adjust',  load: loadInventory },
  reports:       { el: 'sec-reports',      title: 'Reports',           load: () => {} },
  audit:         { el: 'sec-audit',        title: 'Audit Logs',        load: loadAudit },
  notifications: { el: 'sec-notifications',title: 'Notifications',     load: () => {} },
};

let currentSection = 'dashboard';

document.querySelectorAll('#sidebar nav a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const key = link.dataset.section;
    switchSection(key);
  });
});

function switchSection(key) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.remove('active'));
  const sec = sections[key];
  if (!sec) return;
  document.getElementById(sec.el).classList.add('active');
  document.querySelector(`[data-section="${key}"]`).classList.add('active');
  document.getElementById('page-title').textContent = sec.title;
  currentSection = key;
  sec.load();
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    const badge = document.getElementById('health-badge');
    if (data.status === 'healthy' && data.database === 'ok') {
      badge.textContent = '● System Healthy';
      badge.style.background = '#eafaf1';
      badge.style.color = '#27ae60';
    } else {
      badge.textContent = '⚠ DB Error';
      badge.style.background = '#fff3cd';
      badge.style.color = '#856404';
    }
  } catch {
    document.getElementById('health-badge').textContent = '✗ Unreachable';
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api.get('/api/reports/summary');
    const r = data.data;
    document.getElementById('stat-products').textContent = r.summary.total_products || 0;
    document.getElementById('stat-units').textContent    = r.summary.total_units || 0;
    document.getElementById('stat-value').textContent    = fmtMoney(r.summary.total_value);
    document.getElementById('stat-low').textContent      = r.lowStockItems.length;

    const tbody = document.getElementById('low-stock-table');
    if (!r.lowStockItems.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">🎉 All products have adequate stock</td></tr>';
    } else {
      tbody.innerHTML = r.lowStockItems.map(p => `
        <tr>
          <td>${esc(p.name)}</td>
          <td><code>${esc(p.sku)}</code></td>
          <td class="stock-low">${p.stock_quantity}</td>
          <td>${p.min_stock_level}</td>
        </tr>`).join('');
    }
  } catch (e) {
    toast('Dashboard error: ' + e.message, 'error');
  }
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
let allProducts = [];

async function loadProducts() {
  try {
    const data = await api.get('/api/products');
    allProducts = data.data;
    renderProducts(allProducts);
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderProducts(products) {
  const tbody = document.getElementById('products-table');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No products yet — add one!</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${esc(p.name)}</strong></td>
      <td><code>${esc(p.sku)}</code></td>
      <td><span class="badge-cat">${esc(p.category)}</span></td>
      <td>${fmtMoney(p.price)}</td>
      <td class="${p.stock_quantity <= p.min_stock_level ? 'stock-low' : 'stock-ok'}">${p.stock_quantity}</td>
      <td>${p.min_stock_level}</td>
      <td>
        <button class="btn btn-sm btn-success" onclick="openProductModal(${p.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id},'${esc(p.name)}')">Delete</button>
      </td>
    </tr>`).join('');
}

function openProductModal(id) {
  document.getElementById('modal-product-id').value = id || '';
  document.getElementById('modal-title').textContent = id ? 'Edit Product' : 'Add Product';
  if (id) {
    const p = allProducts.find(x => x.id === id);
    if (p) {
      document.getElementById('p-name').value = p.name;
      document.getElementById('p-sku').value  = p.sku;
      document.getElementById('p-category').value = p.category;
      document.getElementById('p-price').value = p.price;
      document.getElementById('p-stock').value = p.stock_quantity;
      document.getElementById('p-minstock').value = p.min_stock_level;
      document.getElementById('p-desc').value = p.description;
    }
    document.getElementById('p-sku').disabled = true;
    document.getElementById('p-stock').disabled = true;
  } else {
    ['p-name','p-sku','p-price','p-stock','p-minstock','p-desc'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p-sku').disabled = false;
    document.getElementById('p-stock').disabled = false;
    document.getElementById('p-category').value = 'General';
  }
  document.getElementById('product-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('product-modal').classList.remove('open');
}

async function saveProduct() {
  const id = document.getElementById('modal-product-id').value;
  const body = {
    name: document.getElementById('p-name').value.trim(),
    sku:  document.getElementById('p-sku').value.trim(),
    description: document.getElementById('p-desc').value.trim(),
    category: document.getElementById('p-category').value,
    price: document.getElementById('p-price').value,
    stock_quantity: document.getElementById('p-stock').value,
    min_stock_level: document.getElementById('p-minstock').value,
  };
  if (!body.name || !body.sku) { toast('Name and SKU are required', 'error'); return; }
  try {
    if (id) {
      await api.put(`/api/products/${id}`, body);
      toast('Product updated ✓', 'success');
    } else {
      await api.post('/api/products', body);
      toast('Product created ✓', 'success');
    }
    closeModal();
    loadProducts();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api.delete(`/api/products/${id}`);
    toast('Product deleted', 'success');
    loadProducts();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
async function loadInventory() {
  await loadAdjHistory();
  await populateAdjProducts();
}

async function populateAdjProducts() {
  try {
    const data = await api.get('/api/products');
    const sel = document.getElementById('adj-product');
    sel.innerHTML = data.data.map(p =>
      `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)}) — Stock: ${p.stock_quantity}</option>`
    ).join('');
  } catch (e) {}
}

async function doAdjust() {
  const product_id = document.getElementById('adj-product').value;
  const adjustment_type = document.getElementById('adj-type').value;
  const quantity = document.getElementById('adj-qty').value;
  const notes = document.getElementById('adj-notes').value;
  if (!product_id || !quantity) { toast('Fill all required fields', 'error'); return; }
  try {
    const res = await api.post('/api/inventory/adjust', { product_id, adjustment_type, quantity, notes });
    toast(`Adjustment applied. New stock: ${res.newStock}`, 'success');
    await loadInventory();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadAdjHistory() {
  try {
    const data = await api.get('/api/inventory/history');
    const tbody = document.getElementById('adj-table');
    if (!data.data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No adjustments yet</td></tr>';
      return;
    }
    tbody.innerHTML = data.data.map(a => `
      <tr>
        <td>${fmtDate(a.created_at)}</td>
        <td>${esc(a.product_name)} <small>(${esc(a.sku)})</small></td>
        <td class="adj-${a.adjustment_type}">${a.adjustment_type}</td>
        <td>${a.quantity_before}</td>
        <td>${a.quantity_after}</td>
        <td>${esc(a.notes || '—')}</td>
      </tr>`).join('');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
async function loadReport() {
  try {
    const data = await api.get('/api/reports/summary');
    const r = data.data;
    document.getElementById('report-content').innerHTML = `
      <p style="color:#888;font-size:12px;margin-bottom:16px">Generated: ${r.generatedAt} (saved to S3)</p>
      <div class="stat-row">
        <div class="stat-card"><h3>Products</h3><div class="val">${r.summary.total_products}</div></div>
        <div class="stat-card green"><h3>Total Units</h3><div class="val">${r.summary.total_units || 0}</div></div>
        <div class="stat-card orange"><h3>Total Value</h3><div class="val">${fmtMoney(r.summary.total_value)}</div></div>
      </div>
      <h4 style="margin:16px 0 10px">Category Breakdown</h4>
      <table><thead><tr><th>Category</th><th>Products</th><th>Units</th></tr></thead>
      <tbody>${r.categoryBreakdown.map(c => `
        <tr><td>${esc(c.category)}</td><td>${c.count}</td><td>${c.units}</td></tr>`).join('')}
      </tbody></table>
      <h4 style="margin:16px 0 10px">⚠️ Low Stock Items (${r.lowStockItems.length})</h4>
      ${r.lowStockItems.length ? `<table><thead><tr><th>Name</th><th>SKU</th><th>Stock</th><th>Min</th></tr></thead>
      <tbody>${r.lowStockItems.map(p => `
        <tr><td>${esc(p.name)}</td><td>${esc(p.sku)}</td><td class="stock-low">${p.stock_quantity}</td><td>${p.min_stock_level}</td></tr>`).join('')}
      </tbody></table>` : '<p style="color:#27ae60">✓ All products have adequate stock</p>'}
    `;
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── AUDIT ────────────────────────────────────────────────────────────────────
async function loadAudit() {
  try {
    const data = await api.get('/api/audit');
    const tbody = document.getElementById('audit-table');
    if (!data.data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No audit entries</td></tr>';
      return;
    }
    tbody.innerHTML = data.data.map(a => {
      let detail = '';
      try { const d = JSON.parse(a.details); detail = d.name || d.id || d.filename || ''; } catch {}
      return `<tr>
        <td>${fmtDate(a.timestamp)}</td>
        <td><strong>${esc(a.action)}</strong></td>
        <td>${esc(a.userId || '—')}</td>
        <td style="font-size:12px;color:#888">${esc(detail)}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
async function sendNotification() {
  const subject = document.getElementById('notif-subject').value.trim();
  const message = document.getElementById('notif-msg').value.trim();
  if (!subject || !message) { toast('Subject and message required', 'error'); return; }
  try {
    await api.post('/api/notify', { subject, message });
    toast('Notification sent via SNS ✓', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── INIT ────────────────────────────────────────────────────────────────────
checkHealth();
setInterval(checkHealth, 30000);
loadDashboard();
