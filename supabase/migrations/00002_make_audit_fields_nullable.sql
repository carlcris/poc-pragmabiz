-- Migration: Make audit fields nullable for easier seeding
-- Version: 00002
-- Description: Makes created_by and updated_by fields nullable to allow data seeding without users
-- Author: System
-- Date: 2025-11-04

-- Make created_by and updated_by nullable in all tables

ALTER TABLE units_of_measure
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE item_categories
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE items
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE warehouses
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE item_warehouse
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE stock_transactions
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;
