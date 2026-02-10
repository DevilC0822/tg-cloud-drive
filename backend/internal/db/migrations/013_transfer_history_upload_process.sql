ALTER TABLE transfer_history
ADD COLUMN IF NOT EXISTS upload_video_faststart_applied BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS upload_video_faststart_fallback BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS upload_video_preview_attached BOOLEAN NULL,
ADD COLUMN IF NOT EXISTS upload_video_preview_fallback BOOLEAN NULL;
