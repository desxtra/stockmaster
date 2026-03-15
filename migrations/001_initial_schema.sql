-- StockMaster Initial Schema
-- Migration: 001_initial_schema.sql

BEGIN;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    sku              VARCHAR(100) NOT NULL UNIQUE,
    description      TEXT DEFAULT '',
    category         VARCHAR(100) DEFAULT 'General',
    price            NUMERIC(12, 2) DEFAULT 0.00,
    stock_quantity   INTEGER NOT NULL DEFAULT 0,
    min_stock_level  INTEGER NOT NULL DEFAULT 5,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory adjustments table
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id               SERIAL PRIMARY KEY,
    product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    adjustment_type  VARCHAR(10) NOT NULL CHECK (adjustment_type IN ('IN','OUT','SET')),
    quantity_before  INTEGER NOT NULL,
    quantity_after   INTEGER NOT NULL,
    notes            TEXT DEFAULT '',
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_adj_product_id    ON inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_adj_created_at    ON inventory_adjustments(created_at);

-- Seed data
INSERT INTO products (name, sku, description, category, price, stock_quantity, min_stock_level)
VALUES
  ('Wireless Keyboard',   'WK-001', 'Compact wireless keyboard', 'Electronics', 45.99,  50, 10),
  ('USB-C Hub 7-Port',    'UH-002', 'USB-C hub with 7 ports',   'Electronics', 29.99,   8,  5),
  ('Office Chair',        'OC-003', 'Ergonomic office chair',   'Furniture',  199.00,  15,  3),
  ('Notebook A5',         'NB-004', 'Lined A5 notebook 200pg',  'Stationery',   4.50, 200, 50),
  ('Standing Desk Mat',   'DM-005', 'Anti-fatigue desk mat',    'Furniture',   39.99,   4,  5)
ON CONFLICT (sku) DO NOTHING;

COMMIT;
