-- Migration: Add user_id to employees table
-- Description: Link employees to user accounts for authentication
-- Created: 2025-12-02

-- Add user_id column to employees table
ALTER TABLE employees
    ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for user_id lookups
CREATE INDEX idx_employees_user_id ON employees(user_id) WHERE deleted_at IS NULL;

-- Add unique constraint to ensure one employee per user
CREATE UNIQUE INDEX idx_employees_user_id_unique ON employees(company_id, user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN employees.user_id IS 'Link to user account for authentication. One user can be one employee per company.';
