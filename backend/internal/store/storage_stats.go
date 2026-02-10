package store

import "context"

func (s *Store) GetStorageStats(ctx context.Context) (StorageStats, error) {
	const q = `
SELECT
  COALESCE(SUM(size), 0) AS total_bytes,
  COUNT(*) AS total_files,
  COALESCE(SUM(size) FILTER (WHERE type = 'image'), 0) AS image_bytes,
  COUNT(*) FILTER (WHERE type = 'image') AS image_count,
  COALESCE(SUM(size) FILTER (WHERE type = 'video'), 0) AS video_bytes,
  COUNT(*) FILTER (WHERE type = 'video') AS video_count,
  COALESCE(SUM(size) FILTER (WHERE type = 'audio'), 0) AS audio_bytes,
  COUNT(*) FILTER (WHERE type = 'audio') AS audio_count,
  COALESCE(SUM(size) FILTER (WHERE type = 'document'), 0) AS document_bytes,
  COUNT(*) FILTER (WHERE type = 'document') AS document_count,
  COALESCE(SUM(size) FILTER (WHERE type = 'archive'), 0) AS archive_bytes,
  COUNT(*) FILTER (WHERE type = 'archive') AS archive_count,
  COALESCE(SUM(size) FILTER (WHERE type = 'code'), 0) AS code_bytes,
  COUNT(*) FILTER (WHERE type = 'code') AS code_count,
  COALESCE(
    SUM(size) FILTER (
      WHERE type = 'other' OR type NOT IN ('folder', 'image', 'video', 'audio', 'document', 'archive', 'code')
    ),
    0
  ) AS other_bytes,
  COUNT(*) FILTER (
    WHERE type = 'other' OR type NOT IN ('folder', 'image', 'video', 'audio', 'document', 'archive', 'code')
  ) AS other_count
FROM items
WHERE type <> 'folder'
`

	var (
		totalBytes    int64
		totalFiles    int64
		imageBytes    int64
		imageCount    int64
		videoBytes    int64
		videoCount    int64
		audioBytes    int64
		audioCount    int64
		documentBytes int64
		documentCount int64
		archiveBytes  int64
		archiveCount  int64
		codeBytes     int64
		codeCount     int64
		otherBytes    int64
		otherCount    int64
	)

	if err := s.db.QueryRow(ctx, q).Scan(
		&totalBytes,
		&totalFiles,
		&imageBytes,
		&imageCount,
		&videoBytes,
		&videoCount,
		&audioBytes,
		&audioCount,
		&documentBytes,
		&documentCount,
		&archiveBytes,
		&archiveCount,
		&codeBytes,
		&codeCount,
		&otherBytes,
		&otherCount,
	); err != nil {
		return StorageStats{}, err
	}

	return StorageStats{
		TotalBytes: totalBytes,
		TotalFiles: totalFiles,
		ByType: map[ItemType]StorageTypeStats{
			ItemTypeImage:    {Bytes: imageBytes, Count: imageCount},
			ItemTypeVideo:    {Bytes: videoBytes, Count: videoCount},
			ItemTypeAudio:    {Bytes: audioBytes, Count: audioCount},
			ItemTypeDocument: {Bytes: documentBytes, Count: documentCount},
			ItemTypeArchive:  {Bytes: archiveBytes, Count: archiveCount},
			ItemTypeCode:     {Bytes: codeBytes, Count: codeCount},
			ItemTypeOther:    {Bytes: otherBytes, Count: otherCount},
		},
	}, nil
}
