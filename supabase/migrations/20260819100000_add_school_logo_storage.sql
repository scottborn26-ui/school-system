INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "school_assets_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-assets');

CREATE POLICY "school_assets_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'school-assets');

CREATE POLICY "school_assets_authenticated_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'school-assets')
WITH CHECK (bucket_id = 'school-assets');

CREATE POLICY "school_assets_authenticated_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'school-assets');
