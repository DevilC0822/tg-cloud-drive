package api

import (
	"errors"
	"testing"

	"github.com/const/tg-cloud-drive/backend/internal/store"
	"github.com/google/uuid"
)

func TestParseFolderScope(t *testing.T) {
	t.Parallel()

	scope, err := parseFolderScope("")
	if err != nil {
		t.Fatalf("parseFolderScope(\"\") returned error: %v", err)
	}
	if scope != store.FolderScopeFiles {
		t.Fatalf("default scope = %s, want %s", scope, store.FolderScopeFiles)
	}

	scope, err = parseFolderScope("vault")
	if err != nil {
		t.Fatalf("parseFolderScope(\"vault\") returned error: %v", err)
	}
	if scope != store.FolderScopeVault {
		t.Fatalf("scope = %s, want %s", scope, store.FolderScopeVault)
	}

	_, err = parseFolderScope("invalid")
	if !errors.Is(err, store.ErrBadInput) {
		t.Fatalf("parseFolderScope(\"invalid\") error = %v, want ErrBadInput", err)
	}
}

func TestChangedVaultItems(t *testing.T) {
	t.Parallel()

	same := uuid.New()
	diff := uuid.New()
	items := []store.Item{
		{ID: same, InVault: true},
		{ID: diff, InVault: false},
	}

	changed := changedVaultItems(items, true)
	if len(changed) != 1 {
		t.Fatalf("changed count = %d, want 1", len(changed))
	}
	if changed[0].ID != diff {
		t.Fatalf("changed id = %s, want %s", changed[0].ID.String(), diff.String())
	}
}
