-- Migration: Add employee_id to users table
-- Description: Link users to their employee records for faster access
-- Created: 2025-12-02
--
-- This creates a reverse reference from users to employees for better performance.
-- The employees.user_id column is kept for audit trails and as a backup reference.

-- Add employee_id column to users table
ALTER TABLE users
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Create index for employee_id lookups
CREATE INDEX idx_users_employee_id ON users(employee_id);

-- Create unique constraint to ensure one user per employee
CREATE UNIQUE INDEX idx_users_employee_id_unique ON users(employee_id)
    WHERE employee_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.employee_id IS 'Link to employee record for this user. Provides fast access to employee data from user session. One employee can only be linked to one user.';
