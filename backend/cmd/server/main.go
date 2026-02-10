package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/api"
	"github.com/const/tg-cloud-drive/backend/internal/config"
	"github.com/const/tg-cloud-drive/backend/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

func waitForPostgres(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	deadlineCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	backoff := 200 * time.Millisecond
	for {
		if deadlineCtx.Err() != nil {
			return errors.New("等待 PostgreSQL 就绪超时（60s）")
		}

		pingCtx, pingCancel := context.WithTimeout(deadlineCtx, 3*time.Second)
		err := pool.Ping(pingCtx)
		pingCancel()
		if err == nil {
			return nil
		}

		logger.Warn("PostgreSQL 未就绪，准备重试", slog.String("error", err.Error()))
		select {
		case <-deadlineCtx.Done():
			return errors.New("等待 PostgreSQL 就绪超时（60s）")
		case <-time.After(backoff):
		}

		if backoff < 3*time.Second {
			backoff *= 2
			if backoff > 3*time.Second {
				backoff = 3 * time.Second
			}
		}
	}
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("配置加载失败", slog.String("error", err.Error()))
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("数据库连接失败", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer pool.Close()

	if err := waitForPostgres(ctx, pool, logger); err != nil {
		logger.Error("数据库未就绪", slog.String("error", err.Error()))
		os.Exit(1)
	}

	if err := db.Migrate(ctx, pool); err != nil {
		logger.Error("数据库迁移失败", slog.String("error", err.Error()))
		os.Exit(1)
	}

	app, err := api.NewServer(api.ServerDeps{
		Logger: logger,
		Cfg:    cfg,
		DB:     pool,
	})
	if err != nil {
		logger.Error("服务初始化失败", slog.String("error", err.Error()))
		os.Exit(1)
	}

	server := &http.Server{
		Addr:              cfg.ListenAddr(),
		Handler:           app.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		logger.Error("监听失败", slog.String("addr", server.Addr), slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Info("后端启动", slog.String("addr", server.Addr))

	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("优雅关闭失败", slog.String("error", err.Error()))
		}
	}()

	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("服务异常退出", slog.String("error", err.Error()))
		os.Exit(1)
	}

	logger.Info("后端已退出")
}
