/**
 * db-migrate.js
 * Runs SQL migrations against the PostgreSQL database.
 * Called by .ebextensions/02-db-migration.config on deployment.
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'stockmaster_prod',
  user:     process.env.DB_USER     || 'stockmaster_admin',
  password: process.env.DB_PASSWORD || 'changeme',
  connectionTimeoutMillis: 10000,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Connected to database');

    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      // Check if already applied
      const { rows } = await client.query(
        'SELECT id FROM schema_migrations WHERE filename=$1', [file]
      );
      if (rows.length > 0) {
        console.log(`[Migration] Skipping (already applied): ${file}`);
        continue;
      }

      console.log(`[Migration] Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)', [file]
      );
      console.log(`[Migration] Done: ${file}`);
    }

    console.log('[Migration] All migrations complete');
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
