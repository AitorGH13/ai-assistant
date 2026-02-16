-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create conversations table with proper Foreign Key to Auth Users
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    history JSONB NOT NULL DEFAULT '[]'::jsonb, -- Strict structure: [{id: 0|1, msg: text, date: iso_string}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create voice_sessions table
CREATE TABLE IF NOT EXISTS public.voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transcript JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{id: 0|1, text: text, timestamp: number}]
    audio_url TEXT, -- URL from Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON public.voice_sessions(user_id);

-- 4. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Row Level Security (RLS)
-- Although the Backend uses the Service Key (Admin), enabling RLS is best practice to prevent direct client access via Anon Key.

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for Conversations
CREATE POLICY "Users can only view their own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON public.conversations FOR DELETE
USING (auth.uid() = user_id);

-- Policies for Voice Sessions
CREATE POLICY "Users can view their own voice sessions"
ON public.voice_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice sessions"
ON public.voice_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 6. Storage Bucket Setup (Safe Creation)
-- Create a new bucket 'chat-assets' for audio files if it doesn't exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-assets', 'chat-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Allow authenticated users to upload, Public to read)
CREATE POLICY "Authenticated users can upload chat assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-assets');

CREATE POLICY "Public can view chat assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-assets');
