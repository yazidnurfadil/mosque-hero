-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create superhero_generations table
CREATE TABLE IF NOT EXISTS superhero_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_image_url TEXT,
    superhero_image_url TEXT,
    composite_image_url TEXT,
    frame_type TEXT DEFAULT 'default',
    generation_status TEXT DEFAULT 'processing' CHECK (generation_status IN ('processing', 'completed', 'failed')),
    replicate_prediction_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_superhero_generations_user_id ON superhero_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_superhero_generations_created_at ON superhero_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_superhero_generations_status ON superhero_generations(generation_status);
CREATE INDEX IF NOT EXISTS idx_superhero_generations_replicate_id ON superhero_generations(replicate_prediction_id);

-- Enable Row Level Security (RLS)
ALTER TABLE superhero_generations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow users to see their own generations and anonymous generations
CREATE POLICY "Users can view own generations" ON superhero_generations
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (auth.uid() IS NULL AND user_id IS NULL)
    );

-- Allow users to insert their own generations
CREATE POLICY "Users can insert own generations" ON superhero_generations
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (auth.uid() IS NULL AND user_id IS NULL)
    );

-- Allow users to update their own generations
CREATE POLICY "Users can update own generations" ON superhero_generations
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        (auth.uid() IS NULL AND user_id IS NULL)
    );

-- Allow users to delete their own generations
CREATE POLICY "Users can delete own generations" ON superhero_generations
    FOR DELETE USING (
        auth.uid() = user_id OR 
        (auth.uid() IS NULL AND user_id IS NULL)
    );

-- Create storage bucket for superhero images
INSERT INTO storage.buckets (id, name, public)
VALUES ('superhero-images', 'superhero-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
-- Allow public read access to superhero images
CREATE POLICY "Public read access for superhero images" ON storage.objects
    FOR SELECT USING (bucket_id = 'superhero-images');

-- Allow authenticated and anonymous users to upload images
CREATE POLICY "Allow uploads to superhero images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'superhero-images' AND
        (auth.role() = 'authenticated' OR auth.role() = 'anon')
    );

-- Allow users to update their own images
CREATE POLICY "Allow updates to own superhero images" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'superhero-images' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR 
         (auth.uid() IS NULL AND (storage.foldername(name))[1] = 'anonymous'))
    );

-- Allow users to delete their own images
CREATE POLICY "Allow deletes of own superhero images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'superhero-images' AND
        (auth.uid()::text = (storage.foldername(name))[1] OR 
         (auth.uid() IS NULL AND (storage.foldername(name))[1] = 'anonymous'))
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_superhero_generations_updated_at
    BEFORE UPDATE ON superhero_generations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON superhero_generations TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
