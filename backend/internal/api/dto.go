package api

import (
	"net/http"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

const minimumPaginationTotalPages int64 = 1

type ItemDTO struct {
	ID             string     `json:"id"`
	Type           string     `json:"type"`
	Name           string     `json:"name"`
	ParentID       *string    `json:"parentId"`
	Path           string     `json:"path"`
	Size           int64      `json:"size"`
	MimeType       *string    `json:"mimeType"`
	IsVaulted      bool       `json:"isVaulted"`
	IsStarred      bool       `json:"isStarred"`
	IsShared       bool       `json:"isShared"`
	SharedCode     *string    `json:"sharedCode"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
	LastAccessedAt *time.Time `json:"lastAccessedAt"`
}

type vaultStatusResponse struct {
	Enabled   bool   `json:"enabled"`
	Unlocked  bool   `json:"unlocked"`
	ExpiresAt string `json:"expiresAt"`
}

type paginationResponse struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"pageSize"`
	TotalCount int64 `json:"totalCount"`
	TotalPages int64 `json:"totalPages"`
}

type itemsListResponse struct {
	Items      []ItemDTO            `json:"items"`
	Pagination paginationResponse   `json:"pagination"`
	Vault      *vaultStatusResponse `json:"vault,omitempty"`
}

type foldersListResponse struct {
	Items []ItemDTO            `json:"items"`
	Vault *vaultStatusResponse `json:"vault,omitempty"`
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
		IsStarred:      it.Starred,
		IsShared:       it.IsShared(),
		SharedCode:     it.SharedCode,
		CreatedAt:      it.CreatedAt,
		UpdatedAt:      it.UpdatedAt,
		LastAccessedAt: it.LastAccessedAt,
	}
}

func toItemDTOs(items []store.Item) []ItemDTO {
	if len(items) == 0 {
		return []ItemDTO{}
	}

	dtos := make([]ItemDTO, 0, len(items))
	for _, it := range items {
		dtos = append(dtos, toItemDTO(it))
	}
	return dtos
}

func newPaginationResponse(page int, pageSize int, totalCount int64) paginationResponse {
	totalPages := minimumPaginationTotalPages
	if pageSize > 0 && totalCount > 0 {
		totalPages = (totalCount + int64(pageSize) - 1) / int64(pageSize)
	}
	return paginationResponse{
		Page:       page,
		PageSize:   pageSize,
		TotalCount: totalCount,
		TotalPages: totalPages,
	}
}

func writeItemsListResponse(
	w http.ResponseWriter,
	items []ItemDTO,
	pagination paginationResponse,
	vault *vaultStatusResponse,
) {
	writeJSON(w, http.StatusOK, itemsListResponse{
		Items:      normalizeItemDTOs(items),
		Pagination: pagination,
		Vault:      vault,
	})
}

func writeFoldersListResponse(w http.ResponseWriter, items []ItemDTO, vault *vaultStatusResponse) {
	writeJSON(w, http.StatusOK, foldersListResponse{
		Items: normalizeItemDTOs(items),
		Vault: vault,
	})
}

func normalizeItemDTOs(items []ItemDTO) []ItemDTO {
	if items == nil {
		return []ItemDTO{}
	}
	return items
}
