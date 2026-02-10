package store

import (
	"time"

	"github.com/google/uuid"
)

type ItemType string

const (
	ItemTypeFolder   ItemType = "folder"
	ItemTypeDocument ItemType = "document"
	ItemTypeImage    ItemType = "image"
	ItemTypeVideo    ItemType = "video"
	ItemTypeAudio    ItemType = "audio"
	ItemTypeArchive  ItemType = "archive"
	ItemTypeCode     ItemType = "code"
	ItemTypeOther    ItemType = "other"
)

type Item struct {
	ID             uuid.UUID
	Type           ItemType
	Name           string
	ParentID       *uuid.UUID
	Path           string
	Size           int64
	MimeType       *string
	IsFavorite     bool
	InVault        bool
	TrashedAt      *time.Time
	LastAccessedAt *time.Time
	SharedCode     *string
	SharedEnabled  bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (i Item) IsShared() bool {
	return i.SharedEnabled && i.SharedCode != nil && *i.SharedCode != ""
}

type Chunk struct {
	ID             uuid.UUID
	ItemID         uuid.UUID
	ChunkIndex     int
	ChunkSize      int
	TGChatID       string
	TGMessageID    int64
	TGFileID       string
	TGFileUniqueID string
	CreatedAt      time.Time
}

type StorageTypeStats struct {
	Bytes int64
	Count int64
}

type StorageStats struct {
	TotalBytes int64
	TotalFiles int64
	ByType     map[ItemType]StorageTypeStats
}

type UploadSessionStatus string

const (
	UploadSessionStatusUploading UploadSessionStatus = "uploading"
	UploadSessionStatusCompleted UploadSessionStatus = "completed"
	UploadSessionStatusFailed    UploadSessionStatus = "failed"
)

type UploadSession struct {
	ID           uuid.UUID
	ItemID       uuid.UUID
	FileName     string
	MimeType     *string
	FileSize     int64
	ChunkSize    int
	TotalChunks  int
	AccessMethod string
	Status       UploadSessionStatus
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type TransferDirection string

const (
	TransferDirectionUpload   TransferDirection = "upload"
	TransferDirectionDownload TransferDirection = "download"
)

type TransferStatus string

const (
	TransferStatusCompleted TransferStatus = "completed"
	TransferStatusError     TransferStatus = "error"
	TransferStatusCanceled  TransferStatus = "canceled"
)

type TransferHistory struct {
	ID                           uuid.UUID
	SourceTaskID                 string
	Direction                    TransferDirection
	FileID                       *uuid.UUID
	FileName                     string
	Size                         int64
	Status                       TransferStatus
	Error                        *string
	UploadVideoFaststartApplied  *bool
	UploadVideoFaststartFallback *bool
	UploadVideoPreviewAttached   *bool
	UploadVideoPreviewFallback   *bool
	StartedAt                    time.Time
	FinishedAt                   time.Time
	CreatedAt                    time.Time
	UpdatedAt                    time.Time
}

type TorrentSourceType string

const (
	TorrentSourceTypeURL  TorrentSourceType = "url"
	TorrentSourceTypeFile TorrentSourceType = "file"
)

type TorrentTaskStatus string

const (
	TorrentTaskStatusQueued            TorrentTaskStatus = "queued"
	TorrentTaskStatusDownloading       TorrentTaskStatus = "downloading"
	TorrentTaskStatusAwaitingSelection TorrentTaskStatus = "awaiting_selection"
	TorrentTaskStatusUploading         TorrentTaskStatus = "uploading"
	TorrentTaskStatusCompleted         TorrentTaskStatus = "completed"
	TorrentTaskStatusError             TorrentTaskStatus = "error"
)

type TorrentTask struct {
	ID                 uuid.UUID
	SourceType         TorrentSourceType
	SourceURL          *string
	TorrentName        string
	InfoHash           string
	TorrentFilePath    string
	QBTorrentHash      *string
	TargetChatID       string
	TargetParentID     *uuid.UUID
	SubmittedBy        string
	EstimatedSize      int64
	DownloadedBytes    int64
	Progress           float64
	IsPrivate          bool
	TrackerHosts       []string
	Status             TorrentTaskStatus
	Error              *string
	StartedAt          *time.Time
	FinishedAt         *time.Time
	SourceCleanupDueAt *time.Time
	SourceCleanupDone  bool
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type TorrentTaskFile struct {
	TaskID         uuid.UUID
	FileIndex      int
	FilePath       string
	FileName       string
	FileSize       int64
	Selected       bool
	Uploaded       bool
	UploadedItemID *uuid.UUID
	Error          *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type TelegramDeleteFailure struct {
	ID          uuid.UUID
	ItemID      *uuid.UUID
	ItemPath    string
	TGChatID    string
	TGMessageID int64
	Error       string
	RetryCount  int
	Resolved    bool
	FailedAt    time.Time
	LastRetryAt time.Time
	ResolvedAt  *time.Time
}

type View string

const (
	ViewFiles     View = "files"
	ViewFavorites View = "favorites"
	ViewRecent    View = "recent"
	ViewTrash     View = "trash"
	ViewVault     View = "vault"
)

type SortBy string

const (
	SortByName SortBy = "name"
	SortByDate SortBy = "date"
	SortBySize SortBy = "size"
	SortByType SortBy = "type"
)

type SortOrder string

const (
	SortOrderAsc  SortOrder = "asc"
	SortOrderDesc SortOrder = "desc"
)

type ListParams struct {
	View      View
	ParentID  *uuid.UUID
	Search    string
	SortBy    SortBy
	SortOrder SortOrder
	Page      int
	PageSize  int
}
