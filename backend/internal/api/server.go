package api

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/config"
	"github.com/const/tg-cloud-drive/backend/internal/telegram"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
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

	transferMu          sync.Mutex
	activeUploads       int
	activeDownloads     int
	activeThumbnailJobs int

	cleanupMu      sync.Mutex
	cleanupRunning bool

	thumbGenMu      sync.Mutex
	thumbGenerating map[string]chan struct{}
}

type cachedFilePath struct {
	FilePath  string
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
		logger:          l,
		cfg:             deps.Cfg,
		db:              deps.DB,
		filePathCache:   map[string]cachedFilePath{},
		thumbGenerating: map[string]chan struct{}{},
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
			pr.Get("/folders", s.handleListFolders)
			pr.Get("/settings", s.handleGetSettings)
			pr.Get("/settings/access", s.handleGetServiceAccess)
			pr.Get("/storage/stats", s.handleGetStorageStats)
			pr.Get("/vault/status", s.handleVaultStatus)
			pr.Get("/transfers/history", s.handleGetTransferHistory)
			pr.Post("/folders", s.handleCreateFolder)
			pr.Patch("/settings", s.handlePatchSettings)
			pr.Patch("/settings/access", s.handlePatchServiceAccess)
			pr.Post("/vault/unlock", s.handleVaultUnlock)
			pr.Post("/vault/lock", s.handleVaultLock)
			pr.Post("/transfers/history", s.handleUpsertTransferHistory)
			pr.Delete("/transfers/history", s.handleDeleteTransferHistory)
			pr.Delete("/transfers/history/{id}", s.handleDeleteTransferHistoryItem)
			pr.Post("/torrents/preview", s.handlePreviewTorrent)
			pr.Post("/torrents/tasks", s.handleCreateTorrentTask)
			pr.Get("/torrents/tasks", s.handleListTorrentTasks)
			pr.Get("/torrents/tasks/{id}", s.handleGetTorrentTask)
			pr.Delete("/torrents/tasks/{id}", s.handleDeleteTorrentTask)
			pr.Post("/torrents/tasks/{id}/dispatch", s.handleDispatchTorrentTask)
			pr.Post("/torrents/tasks/{id}/retry", s.handleRetryTorrentTask)

			pr.Patch("/items/{id}", s.handlePatchItem)
			pr.Post("/items/{id}/vault", s.handleSetItemVault)
			pr.Post("/items/{id}/trash", s.handleTrashItem)
			pr.Post("/items/{id}/restore", s.handleRestoreItem)
			pr.Delete("/items/{id}", s.handleDeleteItemPermanently)
			pr.Post("/items/{id}/copy", s.handleCopyItem)

			pr.Post("/items/{id}/share", s.handleShareItem)
			pr.Delete("/items/{id}/share", s.handleUnshareItem)

			pr.Post("/uploads", s.handleCreateUploadSession)
			pr.Get("/uploads/{id}", s.handleGetUploadSession)
			pr.Post("/uploads/{id}/chunks/{index}", s.handleUploadSessionChunk)
			pr.Post("/uploads/{id}/complete", s.handleCompleteUploadSession)

			pr.Post("/files/upload", s.handleUploadFile)

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
