-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create orders table
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

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

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

-- Create index on created_at for better performance
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Create index on driver for filtering
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver);
