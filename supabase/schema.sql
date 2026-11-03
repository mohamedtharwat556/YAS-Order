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
-- DRIVER LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_locations (
  id BIGSERIAL PRIMARY KEY,
  driver_id TEXT NOT NULL,
  order_id TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) FOR DRIVER LOCATIONS
-- ============================================
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access on driver_locations" ON driver_locations;
DROP POLICY IF EXISTS "Public insert access on driver_locations" ON driver_locations;

-- Create policies for public access
CREATE POLICY "Public read access on driver_locations" ON driver_locations
  FOR SELECT USING (true);

CREATE POLICY "Public insert access on driver_locations" ON driver_locations
  FOR INSERT WITH CHECK (true);

-- ============================================
-- INDEXES FOR DRIVER LOCATIONS
-- ============================================
DROP INDEX IF EXISTS idx_driver_locations_driver;
DROP INDEX IF EXISTS idx_driver_locations_order;
DROP INDEX IF EXISTS idx_driver_locations_timestamp;

CREATE INDEX idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_order ON driver_locations(order_id);
CREATE INDEX idx_driver_locations_timestamp ON driver_locations(timestamp DESC);

-- ============================================
-- NOTES
-- ============================================
-- This schema contains two tables:
-- 1. orders - manages all order-related data
-- 2. driver_locations - stores GPS locations of drivers for real-time tracking
-- ============================================
