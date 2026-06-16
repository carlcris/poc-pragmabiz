-- Migration: Add RLS policies for users table
-- Allows authenticated users to insert and update their own records

-- Allow authenticated users to insert their own user record
-- This is needed when a user logs in for the first time via Supabase Auth
CREATE POLICY "Allow users to insert their own record"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own user record
CREATE POLICY "Allow users to update their own record"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
