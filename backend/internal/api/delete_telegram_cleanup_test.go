package api

import (
	"errors"
	"testing"
	"time"

	"tg-cloud-drive-api/internal/store"
	"tg-cloud-drive-api/internal/telegram"
)

func TestCollectTelegramDeleteTargets(t *testing.T) {
	t.Parallel()

	refs := []store.ChunkDeleteRef{
		{TGChatID: "", TGMessageID: 100, CreatedAt: time.Unix(100, 0), ItemType: store.ItemTypeImage},
		{TGChatID: "-1001", TGMessageID: 101, CreatedAt: time.Unix(101, 0), ItemType: store.ItemTypeVideo},
		{TGChatID: "-1001", TGMessageID: 101, CreatedAt: time.Unix(999, 0), ItemType: store.ItemTypeVideo},
		{TGChatID: " ", TGMessageID: 0, CreatedAt: time.Unix(102, 0), ItemType: store.ItemTypeDocument},
	}

	targets := collectTelegramDeleteTargets("-100-default", refs)
	if len(targets) != 2 {
		t.Fatalf("len(targets) = %d, want 2", len(targets))
	}
	if targets[0].chatID != "-100-default" || targets[0].messageID != 100 {
		t.Fatalf("unexpected first target: %+v", targets[0])
	}
	if targets[1].chatID != "-1001" || targets[1].messageID != 101 {
		t.Fatalf("unexpected second target: %+v", targets[1])
	}
	if !targets[0].createdAt.Equal(time.Unix(100, 0)) {
		t.Fatalf("unexpected first target createdAt: %s", targets[0].createdAt)
	}
	if targets[0].itemType != store.ItemTypeImage {
		t.Fatalf("unexpected first target itemType: %s", targets[0].itemType)
	}
}

func TestNormalizeTelegramDeleteParallelism(t *testing.T) {
	t.Parallel()

	if got := normalizeTelegramDeleteParallelism(1); got != telegramDeleteParallelismMin {
		t.Fatalf("normalizeTelegramDeleteParallelism(1) = %d, want %d", got, telegramDeleteParallelismMin)
	}
	if got := normalizeTelegramDeleteParallelism(12); got != telegramDeleteParallelismDefault {
		t.Fatalf("normalizeTelegramDeleteParallelism(12) = %d, want %d", got, telegramDeleteParallelismDefault)
	}
	if got := normalizeTelegramDeleteParallelism(64); got != telegramDeleteParallelismMax {
		t.Fatalf("normalizeTelegramDeleteParallelism(64) = %d, want %d", got, telegramDeleteParallelismMax)
	}
}

func TestShouldEditDeletedMessage(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_800_000_000, 0)
	if shouldEditDeletedMessage(time.Time{}, now) {
		t.Fatal("zero createdAt should not force edit path")
	}
	if shouldEditDeletedMessage(now.Add(-47*time.Hour), now) {
		t.Fatal("message younger than 48h should still try delete first")
	}
	if !shouldEditDeletedMessage(now.Add(-48*time.Hour), now) {
		t.Fatal("message at 48h threshold should switch to edit path")
	}
}

func TestShouldReplaceAfterDeleteError(t *testing.T) {
	t.Parallel()

	if shouldReplaceAfterDeleteError(nil) {
		t.Fatal("nil error should not trigger replacement")
	}
	if shouldReplaceAfterDeleteError(errors.New("network timeout")) {
		t.Fatal("generic error should not trigger replacement")
	}
	if !shouldReplaceAfterDeleteError(telegram.MessageCannotBeDeletedError{Message: "Bad Request: message can't be deleted"}) {
		t.Fatal("non-deletable telegram error should trigger replacement")
	}
}

func TestUsesPhotoDeletedPlaceholder(t *testing.T) {
	t.Parallel()

	if !usesPhotoDeletedPlaceholder(store.ItemTypeImage) {
		t.Fatal("image should use photo placeholder")
	}
	if !usesPhotoDeletedPlaceholder(store.ItemTypeVideo) {
		t.Fatal("video should use photo placeholder")
	}
	if usesPhotoDeletedPlaceholder(store.ItemTypeDocument) {
		t.Fatal("document should not use photo placeholder")
	}
}
