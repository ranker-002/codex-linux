-- Supabase Database Schema for Codex Linux Cloud Sync
-- Run this in your Supabase SQL Editor

-- Enable realtime for threads table
alter publication supabase_realtime add table threads;

-- Create threads table
CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    device_id TEXT NOT NULL,
    project_path TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'idle',
    last_modified BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    version INTEGER NOT NULL DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_agent_id ON threads(agent_id);
CREATE INDEX IF NOT EXISTS idx_threads_device_id ON threads(device_id);
CREATE INDEX IF NOT EXISTS idx_threads_last_modified ON threads(last_modified);
CREATE INDEX IF NOT EXISTS idx_threads_user_deleted ON threads(user_id, is_deleted);

-- Create users table for cloud sync
CREATE TABLE IF NOT EXISTS cloud_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    devices JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    subscription_tier TEXT DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create devices table to track user devices
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    last_sync BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, device_id)
);

-- Create sync conflicts table for manual resolution
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    local_version JSONB NOT NULL,
    remote_version JSONB NOT NULL,
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Threads policies
CREATE POLICY "Users can only access their own threads"
    ON threads FOR ALL
    USING (user_id = auth.uid());

-- Cloud users policies
CREATE POLICY "Users can only access their own profile"
    ON cloud_users FOR ALL
    USING (id = auth.uid());

-- User devices policies
CREATE POLICY "Users can only access their own devices"
    ON user_devices FOR ALL
    USING (user_id = auth.uid());

-- Sync conflicts policies
CREATE POLICY "Users can only access their own conflicts"
    ON sync_conflicts FOR ALL
    USING (user_id = auth_uid());

-- Functions

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cloud_users_updated_at
    BEFORE UPDATE ON cloud_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get threads modified since a timestamp
CREATE OR REPLACE FUNCTION get_threads_since(
    p_user_id UUID,
    p_since BIGINT
)
RETURNS TABLE (
    id UUID,
    agent_id UUID,
    user_id UUID,
    device_id TEXT,
    project_path TEXT,
    messages JSONB,
    status TEXT,
    last_modified BIGINT,
    version INTEGER,
    is_deleted BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.*
    FROM threads t
    WHERE t.user_id = p_user_id
    AND t.last_modified > p_since
    AND t.is_deleted = FALSE
    ORDER BY t.last_modified DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert thread with conflict detection
CREATE OR REPLACE FUNCTION upsert_thread(
    p_id UUID,
    p_agent_id UUID,
    p_user_id UUID,
    p_device_id TEXT,
    p_project_path TEXT,
    p_messages JSONB,
    p_status TEXT,
    p_last_modified BIGINT,
    p_version INTEGER,
    p_is_deleted BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    existing_version INTEGER;
    result JSONB;
BEGIN
    -- Check if thread exists and get its version
    SELECT version INTO existing_version
    FROM threads
    WHERE id = p_id;
    
    IF existing_version IS NULL THEN
        -- Insert new thread
        INSERT INTO threads (
            id, agent_id, user_id, device_id, project_path,
            messages, status, last_modified, version, is_deleted
        ) VALUES (
            p_id, p_agent_id, p_user_id, p_device_id, p_project_path,
            p_messages, p_status, p_last_modified, p_version, p_is_deleted
        );
        
        result := jsonb_build_object(
            'success', true,
            'action', 'insert',
            'conflict', false
        );
    ELSIF p_version > existing_version THEN
        -- Update with newer version
        UPDATE threads SET
            agent_id = p_agent_id,
            device_id = p_device_id,
            project_path = p_project_path,
            messages = p_messages,
            status = p_status,
            last_modified = p_last_modified,
            version = p_version,
            is_deleted = p_is_deleted
        WHERE id = p_id;
        
        result := jsonb_build_object(
            'success', true,
            'action', 'update',
            'conflict', false
        );
    ELSE
        -- Version conflict detected
        INSERT INTO sync_conflicts (
            thread_id, user_id, local_version, remote_version
        ) VALUES (
            p_id, p_user_id,
            (SELECT to_jsonb(t.*) FROM threads t WHERE t.id = p_id),
            jsonb_build_object(
                'id', p_id,
                'agent_id', p_agent_id,
                'device_id', p_device_id,
                'project_path', p_project_path,
                'messages', p_messages,
                'status', p_status,
                'last_modified', p_last_modified,
                'version', p_version,
                'is_deleted', p_is_deleted
            )
        );
        
        result := jsonb_build_object(
            'success', false,
            'action', 'none',
            'conflict', true,
            'message', 'Version conflict detected. Manual resolution required.'
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
