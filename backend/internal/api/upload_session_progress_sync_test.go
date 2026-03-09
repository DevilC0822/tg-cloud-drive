package api

import (
	"testing"

	"tg-cloud-drive-api/internal/store"
)

func TestResolveUploadFolderEntryStatus(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		status   store.UploadSessionStatus
		uploaded int
		total    int
		want     store.UploadFolderEntryStatus
	}{
		{
			name:     "failed overrides everything",
			status:   store.UploadSessionStatusFailed,
			uploaded: 0,
			total:    10,
			want:     store.UploadFolderEntryStatusFailed,
		},
		{
			name:     "completed requires session completed",
			status:   store.UploadSessionStatusCompleted,
			uploaded: 0,
			total:    10,
			want:     store.UploadFolderEntryStatusCompleted,
		},
		{
			name:     "uploading with zero chunks stays pending",
			status:   store.UploadSessionStatusUploading,
			uploaded: 0,
			total:    10,
			want:     store.UploadFolderEntryStatusPending,
		},
		{
			name:     "uploading with some chunks is uploading",
			status:   store.UploadSessionStatusUploading,
			uploaded: 1,
			total:    10,
			want:     store.UploadFolderEntryStatusUploading,
		},
		{
			name:     "all chunks uploaded but not finalized is still uploading",
			status:   store.UploadSessionStatusUploading,
			uploaded: 10,
			total:    10,
			want:     store.UploadFolderEntryStatusUploading,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveUploadFolderEntryStatus(tc.status, tc.uploaded, tc.total)
			if got != tc.want {
				t.Fatalf("resolveUploadFolderEntryStatus() = %q, want %q", got, tc.want)
			}
		})
	}
}

