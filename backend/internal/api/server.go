package api

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"tg-cloud-drive-api/internal/config"
	"tg-cloud-drive-api/internal/telegram"
)

type ServerDeps struct {
	Logger *slog.Logger
	Cfg    config.Config
	DB     *pgxpool.Pool
}

type Server struct {
	logger *slog.Logger
	cfg    config.Config
	db     *pgxpool.Pool
	tgMu   sync.RWMutex
	tg     *telegram.Client

	adminPasswordHash string
	setupInitMu       sync.Mutex
	setupInitialized  atomic.Bool
	loopsStarted      atomic.Bool

	filePathMu    sync.Mutex
	filePathCache map[string]cachedFilePath

	transferMu            sync.Mutex
	activeUploads         int
	activeDownloads       int
	activeThumbnailJobs   int
	transferEventsMu      sync.RWMutex
	transferSubscribers   map[uint64]chan transferStreamEvent
	transferSubscriberSeq atomic.Uint64
	downloadProgressMu    sync.RWMutex
	downloadProgress      map[uuid.UUID]downloadTransferProgress

	chunkUploadMu       sync.Mutex
	chunkUploadInFlight map[string]struct{}

	cleanupMu      sync.Mutex
	cleanupRunning bool

	thumbGenMu      sync.Mutex
	thumbGenerating map[string]chan struct{}
}

type cachedFilePath struct {
	FilePath  string
	FileSize  int64
	ExpiresAt time.Time
}

func (s *Server) telegramClient() *telegram.Client {
	s.tgMu.RLock()
	defer s.tgMu.RUnlock()
	return s.tg
}

func (s *Server) setTelegramClient(c *telegram.Client) {
	s.tgMu.Lock()
	s.tg = c
	s.tgMu.Unlock()
}

func NewServer(deps ServerDeps) (*Server, error) {
	l := deps.Logger
	if l == nil {
		l = slog.Default()
	}

	srv := &Server{
		logger:              l,
		cfg:                 deps.Cfg,
		db:                  deps.DB,
		filePathCache:       map[string]cachedFilePath{},
		transferSubscribers: map[uint64]chan transferStreamEvent{},
		downloadProgress:    map[uuid.UUID]downloadTransferProgress{},
		thumbGenerating:     map[string]chan struct{}{},
		chunkUploadInFlight: map[string]struct{}{},
	}

	if deps.DB != nil {
		if err := srv.bootstrapSystemConfig(context.Background()); err != nil {
			return nil, err
		}
	}

	return srv, nil
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()

	r.Use(s.corsMiddleware)
	r.Use(recoverMiddleware(s.logger))
	r.Use(requestLogMiddleware(s.logger))
	r.Use(s.rejectIPHostMiddleware)

	r.Get("/healthz", s.handleHealthz)

	r.Route("/api", func(api chi.Router) {
		api.Get("/setup/status", s.handleSetupStatus)
		api.Post("/setup/test-connection", s.handleSetupTestConnection)
		api.Post("/setup/init", s.handleSetupInit)

		api.Post("/auth/login", s.handleLogin)
		api.Post("/auth/logout", s.handleLogout)
		api.Get("/auth/me", s.handleMe)

		api.Group(func(pr chi.Router) {
			pr.Use(s.setupRequiredMiddleware)
			pr.Use(s.authMiddleware)

			pr.Get("/items", s.handleListItems)
			pr.Get("/items/{id}", s.handleGetItem)
			pr.Get("/folders", s.handleListFolders)
			pr.Get("/settings", s.handleGetSettings)
			pr.Get("/settings/runtime", s.handleGetRuntimeSettings)
			pr.Get("/storage/stats", s.handleGetStorageStats)
			pr.Get("/storage/local-residual", s.handleListLocalResidual)
			pr.Post("/storage/local-residual/{id}/cleanup", s.handleCleanupLocalResidual)
			pr.Get("/vault/status", s.handleVaultStatus)
			pr.Get("/transfers/active", s.handleGetActiveTransfers)
			pr.Get("/transfers/history", s.handleGetTransferHistory)
			pr.Get("/transfers/stream", s.handleTransferStream)
			pr.Get("/transfers/{id}/entries", s.handleGetTransferEntries)
			pr.Get("/transfers/{id}", s.handleGetTransferDetail)
			pr.Delete("/transfers/{id}", s.handleDeleteActiveTransfer)
			pr.Post("/folders", s.handleCreateFolder)
			pr.Patch("/settings", s.handlePatchSettings)
			pr.Post("/vault/unlock", s.handleVaultUnlock)
			pr.Post("/vault/lock", s.handleVaultLock)
			pr.Post("/transfers/downloads", s.handleCreateDownloadTransfer)
			pr.Delete("/transfers/history/{id}", s.handleDeleteTransferHistoryItem)
			pr.Post("/torrents/preview", s.handlePreviewTorrent)
			pr.Post("/torrents/tasks", s.handleCreateTorrentTask)
			pr.Get("/torrents/tasks", s.handleListTorrentTasks)
			pr.Get("/torrents/tasks/{id}", s.handleGetTorrentTask)
			pr.Delete("/torrents/tasks/{id}", s.handleDeleteTorrentTask)
			pr.Post("/torrents/tasks/{id}/dispatch", s.handleDispatchTorrentTask)
			pr.Post("/torrents/tasks/{id}/retry", s.handleRetryTorrentTask)

			pr.Patch("/items/{id}", s.handlePatchItem)
			pr.Post("/items/{id}/star", s.handleSetItemStar)
			pr.Post("/items/{id}/vault", s.handleSetItemVault)
			pr.Post("/items/vault/batch", s.handleBatchSetItemsVault)
			pr.Delete("/items/{id}", s.handleDeleteItemPermanently)
			pr.Post("/items/{id}/copy", s.handleCopyItem)

			pr.Post("/items/{id}/share", s.handleShareItem)
			pr.Delete("/items/{id}/share", s.handleUnshareItem)

			pr.Post("/uploads/batches", s.handleCreateUploadBatch)
			pr.Post("/uploads/folders", s.handleCreateUploadFolder)
			pr.Get("/uploads/folders/{id}/work", s.handleGetUploadFolderWork)
			pr.Post("/uploads", s.handleCreateUploadSession)
			pr.Get("/uploads/{id}", s.handleGetUploadSession)
			pr.Post("/uploads/{id}/chunks/{index}", s.handleUploadSessionChunk)
			pr.Post("/uploads/{id}/complete", s.handleCompleteUploadSession)

			pr.MethodFunc(http.MethodGet, "/items/{id}/content", s.handleItemContent)
			pr.MethodFunc(http.MethodHead, "/items/{id}/content", s.handleItemContent)
			pr.MethodFunc(http.MethodGet, "/items/{id}/thumbnail", s.handleItemThumbnail)
		})
	})

	r.Group(func(pub chi.Router) {
		pub.Use(s.setupRequiredMiddleware)
		pub.MethodFunc(http.MethodGet, "/d/{code}", s.handleSharedDownload)
		pub.MethodFunc(http.MethodHead, "/d/{code}", s.handleSharedDownload)
	})

	return r
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}
