-- Create the superhero_generations table
CREATE TABLE IF NOT EXISTS public.superhero_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  original_image_url TEXT NOT NULL,
  superhero_image_url TEXT,
  composite_image_url TEXT,
  frame_type TEXT NOT NULL,
  replicate_prediction_id TEXT NOT NULL,
  generation_status VARCHAR(20) NOT NULL DEFAULT 'processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_superhero_generations_user_id ON public.superhero_generations(user_id);

-- Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_superhero_generations_created_at ON public.superhero_generations(created_at DESC);

-- Create an index on generation_status for filtering
CREATE INDEX IF NOT EXISTS idx_superhero_generations_status ON public.superhero_generations(generation_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.superhero_generations ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "public read" ON public.superhero_generations
  FOR SELECT USING ( true );

CREATE POLICY "public insert" ON public.superhero_generations
  FOR INSERT WITH CHECK ( true );

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('superhero-images', 'Superhero Images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can view superhero images" ON storage.objects
  FOR SELECT USING (bucket_id = 'superhero-images');

CREATE POLICY "Authenticated users can upload superhero images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'superhero-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own superhero images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'superhero-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own superhero images" ON storage.objects
  FOR DELETE USING (bucket_id = 'superhero-images' AND auth.uid()::text = (storage.foldername(name))[1]);
