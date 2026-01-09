-- Migration: Create user_preferences table
-- Description: Store user-specific preferences like font size, theme, etc.
-- Created: 2026-01-10

-- Create user_preferences table
CREATE TABLE user_preferences (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- UI Preferences
    font_size         VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'extra-large')),
    theme             VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),

    -- Other preferences can be added here
    -- locale          VARCHAR(10) DEFAULT 'en',
    -- date_format     VARCHAR(20) DEFAULT 'MM/DD/YYYY',

    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create unique index to ensure one preferences record per user
CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Create index for lookups
CREATE INDEX idx_user_preferences_updated_at ON user_preferences(updated_at);

-- Add RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only view their own preferences
CREATE POLICY "Users can view own preferences"
    ON user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
    ON user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
    ON user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences"
    ON user_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_preferences IS 'Store user-specific UI preferences and settings';
COMMENT ON COLUMN user_preferences.font_size IS 'App-wide font size preference: small, medium, large, extra-large';
COMMENT ON COLUMN user_preferences.theme IS 'UI theme preference: light, dark, auto';
