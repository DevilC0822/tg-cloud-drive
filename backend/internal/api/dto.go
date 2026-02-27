package api

import (
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

type ItemDTO struct {
	ID             string     `json:"id"`
	Type           string     `json:"type"`
	Name           string     `json:"name"`
	ParentID       *string    `json:"parentId"`
	Path           string     `json:"path"`
	Size           int64      `json:"size"`
	MimeType       *string    `json:"mimeType"`
	IsVaulted      bool       `json:"isVaulted"`
	IsShared       bool       `json:"isShared"`
	SharedCode     *string    `json:"sharedCode"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	LastAccessedAt *time.Time `json:"lastAccessedAt"`
}

func toItemDTO(it store.Item) ItemDTO {
	var parentID *string
	if it.ParentID != nil {
		s := it.ParentID.String()
		parentID = &s
	}

	return ItemDTO{
		ID:             it.ID.String(),
		Type:           string(it.Type),
		Name:           it.Name,
		ParentID:       parentID,
		Path:           it.Path,
		Size:           it.Size,
		MimeType:       it.MimeType,
		IsVaulted:      it.InVault,
		IsShared:       it.IsShared(),
		SharedCode:     it.SharedCode,
		CreatedAt:      it.CreatedAt,
		UpdatedAt:      it.UpdatedAt,
		LastAccessedAt: it.LastAccessedAt,
	}
}
