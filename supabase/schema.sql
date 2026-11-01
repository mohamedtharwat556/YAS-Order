-- ============================================
-- YAS Order Tracking System - Supabase Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  maplink TEXT,
  devicetype TEXT NOT NULL,
  brand TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  amount NUMERIC,
  details TEXT NOT NULL,
  paymentmethod TEXT NOT NULL,
  paymentstatus TEXT NOT NULL,
  driver TEXT NOT NULL,
  driverphone TEXT,
  receivedat TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'تم طلبه',
  history JSONB DEFAULT '[]'::jsonb,
  location JSONB,
  deliveryphoto TEXT,
  signature TEXT,
  driverrating INTEGER,
  customernotes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access" ON orders;
DROP POLICY IF EXISTS "Public insert access" ON orders;
DROP POLICY IF EXISTS "Public update access" ON orders;
DROP POLICY IF EXISTS "Public delete access" ON orders;

-- Create policies for public access
-- Allow anyone to read orders
CREATE POLICY "Public read access" ON orders
  FOR SELECT USING (true);

-- Allow anyone to insert orders
CREATE POLICY "Public insert access" ON orders
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update orders
CREATE POLICY "Public update access" ON orders
  FOR UPDATE USING (true);

-- Allow anyone to delete orders
CREATE POLICY "Public delete access" ON orders
  FOR DELETE USING (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- Drop existing indexes if they exist
DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_driver;
DROP INDEX IF EXISTS idx_orders_id;

-- Create index on created_at for better performance
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Create index on status for filtering
CREATE INDEX idx_orders_status ON orders(status);

-- Create index on driver for filtering
CREATE INDEX idx_orders_driver ON orders(driver);

-- Create index on id for faster lookups
CREATE INDEX idx_orders_id ON orders(id);

-- ============================================
-- NOTES
-- ============================================
-- This schema contains only one table: orders
-- The entire application uses this single table
-- to manage all order-related data
-- ============================================
