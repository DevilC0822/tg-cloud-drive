package telegram

import "testing"

func TestPrimaryFile_StickerFallback(t *testing.T) {
	t.Parallel()

	msg := Message{
		MessageID: 1001,
		Sticker: MediaFile{
			FileID:       "sticker-file-id",
			FileUniqueID: "sticker-uniq-id",
			FileSize:     4096,
		},
	}

	doc, ok := msg.PrimaryFile()
	if !ok {
		t.Fatalf("expected primary file from sticker")
	}
	if doc.FileID != "sticker-file-id" {
		t.Fatalf("unexpected file_id: %s", doc.FileID)
	}
	if doc.FileUniqueID != "sticker-uniq-id" {
		t.Fatalf("unexpected file_unique_id: %s", doc.FileUniqueID)
	}
	if doc.FileSize != 4096 {
		t.Fatalf("unexpected file_size: %d", doc.FileSize)
	}
}

func TestNormalizeMessageDocument_StickerFallback(t *testing.T) {
	t.Parallel()

	msg := &Message{
		MessageID: 1002,
		Sticker: MediaFile{
			FileID:       "sticker-file-id-2",
			FileUniqueID: "sticker-uniq-id-2",
			FileSize:     8192,
		},
	}

	normalizeMessageDocument(msg)
	if msg.Document.FileID != "sticker-file-id-2" {
		t.Fatalf("expected normalized document file_id, got: %s", msg.Document.FileID)
	}
	if msg.Document.FileUniqueID != "sticker-uniq-id-2" {
		t.Fatalf("expected normalized document file_unique_id, got: %s", msg.Document.FileUniqueID)
	}
}
