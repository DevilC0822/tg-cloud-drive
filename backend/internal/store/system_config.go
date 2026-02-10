package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type SystemConfig struct {
	TGBotToken        string
	TGStorageChatID   string
	AccessMethod      string
	TGAPIID           *int64
	TGAPIHash         *string
	TGAPIBaseURL      *string
	AdminPasswordHash string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

func (s *Store) GetSystemConfig(ctx context.Context) (SystemConfig, error) {
	var out SystemConfig
	var tgAPIID sql.NullInt64
	var tgAPIHash sql.NullString
	var tgAPIBaseURL sql.NullString
	err := s.db.QueryRow(
		ctx,
		`SELECT tg_bot_token, tg_storage_chat_id, access_method, tg_api_id, tg_api_hash, tg_api_base_url, admin_password_hash, created_at, updated_at
FROM system_config
WHERE singleton = TRUE`,
	).Scan(
		&out.TGBotToken,
		&out.TGStorageChatID,
		&out.AccessMethod,
		&tgAPIID,
		&tgAPIHash,
		&tgAPIBaseURL,
		&out.AdminPasswordHash,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SystemConfig{}, ErrNotFound
		}
		return SystemConfig{}, err
	}
	out.TGBotToken = strings.TrimSpace(out.TGBotToken)
	out.TGStorageChatID = strings.TrimSpace(out.TGStorageChatID)
	out.AccessMethod = strings.TrimSpace(out.AccessMethod)
	if out.AccessMethod == "" {
		out.AccessMethod = "official_bot_api"
	}
	if tgAPIID.Valid {
		v := tgAPIID.Int64
		out.TGAPIID = &v
	}
	if tgAPIHash.Valid {
		v := strings.TrimSpace(tgAPIHash.String)
		if v != "" {
			out.TGAPIHash = &v
		}
	}
	if tgAPIBaseURL.Valid {
		v := strings.TrimSpace(tgAPIBaseURL.String)
		if v != "" {
			out.TGAPIBaseURL = &v
		}
	}
	out.AdminPasswordHash = strings.TrimSpace(out.AdminPasswordHash)
	return out, nil
}

func (s *Store) InitializeSystemConfig(
	ctx context.Context,
	accessMethod string,
	tgBotToken string,
	tgStorageChatID string,
	tgAPIID *int64,
	tgAPIHash *string,
	tgAPIBaseURL *string,
	adminPasswordHash string,
) (SystemConfig, error) {
	accessMethod = strings.TrimSpace(accessMethod)
	if accessMethod == "" {
		accessMethod = "official_bot_api"
	}
	tgBotToken = strings.TrimSpace(tgBotToken)
	tgStorageChatID = strings.TrimSpace(tgStorageChatID)
	if tgAPIID != nil && *tgAPIID <= 0 {
		tgAPIID = nil
	}
	if tgAPIHash != nil {
		trimmed := strings.TrimSpace(*tgAPIHash)
		if trimmed == "" {
			tgAPIHash = nil
		} else {
			tgAPIHash = &trimmed
		}
	}
	if tgAPIBaseURL != nil {
		trimmed := strings.TrimSpace(*tgAPIBaseURL)
		if trimmed == "" {
			tgAPIBaseURL = nil
		} else {
			tgAPIBaseURL = &trimmed
		}
	}
	adminPasswordHash = strings.TrimSpace(adminPasswordHash)
	if accessMethod == "" || tgBotToken == "" || tgStorageChatID == "" || adminPasswordHash == "" {
		return SystemConfig{}, ErrBadInput
	}

	_, err := s.db.Exec(
		ctx,
		`INSERT INTO system_config(
  singleton,
  tg_bot_token,
  tg_storage_chat_id,
  access_method,
  tg_api_id,
  tg_api_hash,
  tg_api_base_url,
  admin_password_hash,
  created_at,
  updated_at
)
VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, now(), now())
ON CONFLICT (singleton) DO UPDATE
SET tg_bot_token = EXCLUDED.tg_bot_token,
    tg_storage_chat_id = EXCLUDED.tg_storage_chat_id,
    access_method = EXCLUDED.access_method,
    tg_api_id = EXCLUDED.tg_api_id,
    tg_api_hash = EXCLUDED.tg_api_hash,
    tg_api_base_url = EXCLUDED.tg_api_base_url,
    admin_password_hash = EXCLUDED.admin_password_hash,
    updated_at = now()`,
		tgBotToken,
		tgStorageChatID,
		accessMethod,
		tgAPIID,
		tgAPIHash,
		tgAPIBaseURL,
		adminPasswordHash,
	)
	if err != nil {
		return SystemConfig{}, err
	}
	return s.GetSystemConfig(ctx)
}

func (s *Store) UpdateSystemConfigAccess(
	ctx context.Context,
	accessMethod string,
	tgBotToken string,
	tgStorageChatID string,
	tgAPIID *int64,
	tgAPIHash *string,
	tgAPIBaseURL *string,
) (SystemConfig, error) {
	accessMethod = strings.TrimSpace(accessMethod)
	if accessMethod == "" {
		return SystemConfig{}, ErrBadInput
	}
	tgBotToken = strings.TrimSpace(tgBotToken)
	tgStorageChatID = strings.TrimSpace(tgStorageChatID)
	if tgBotToken == "" || tgStorageChatID == "" {
		return SystemConfig{}, ErrBadInput
	}
	if tgAPIID != nil && *tgAPIID <= 0 {
		tgAPIID = nil
	}
	if tgAPIHash != nil {
		trimmed := strings.TrimSpace(*tgAPIHash)
		if trimmed == "" {
			tgAPIHash = nil
		} else {
			tgAPIHash = &trimmed
		}
	}
	if tgAPIBaseURL != nil {
		trimmed := strings.TrimSpace(*tgAPIBaseURL)
		if trimmed == "" {
			tgAPIBaseURL = nil
		} else {
			tgAPIBaseURL = &trimmed
		}
	}

	ct, err := s.db.Exec(
		ctx,
		`UPDATE system_config
SET access_method = $1,
    tg_bot_token = $2,
    tg_storage_chat_id = $3,
    tg_api_id = $4,
    tg_api_hash = $5,
    tg_api_base_url = $6,
    updated_at = now()
WHERE singleton = TRUE`,
		accessMethod,
		tgBotToken,
		tgStorageChatID,
		tgAPIID,
		tgAPIHash,
		tgAPIBaseURL,
	)
	if err != nil {
		return SystemConfig{}, err
	}
	if ct.RowsAffected() == 0 {
		return SystemConfig{}, ErrNotFound
	}
	return s.GetSystemConfig(ctx)
}
