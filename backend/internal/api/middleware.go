package api

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"time"
)

func recoverMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error("panic",
						slog.Any("recover", rec),
						slog.String("path", r.URL.Path),
						slog.String("stack", string(debug.Stack())),
					)
					writeJSON(w, http.StatusInternalServerError, map[string]any{
						"error":   "internal_error",
						"message": "服务内部错误",
					})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

func requestLogMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rr := &responseRecorder{ResponseWriter: w, status: 200}
			next.ServeHTTP(rr, r)

			logger.Info("request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", rr.status),
				slog.Int("bytes", rr.bytes),
				slog.Duration("duration", time.Since(start)),
			)
		})
	}
}

type responseRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *responseRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(p []byte) (int, error) {
	n, err := r.ResponseWriter.Write(p)
	r.bytes += n
	return n, err
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	// 开发默认允许 Vite；生产建议显式设置 FRONTEND_ORIGIN
	allowedOrigin := s.cfg.FrontendOrigin
	if allowedOrigin == "" {
		allowedOrigin = "http://localhost:5173"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" && origin == allowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,HEAD,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Range, X-TGCD-Chunked, X-TGCD-Parent-Id")
			w.Header().Set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Range, Content-Length, Content-Type, Content-Disposition, ETag")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) rejectIPHostMiddleware(next http.Handler) http.Handler {
	if !s.cfg.DisableIPPortAccess {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := normalizeRequestHost(r.Host)
		if isIPLiteralHost(host) {
			writeError(w, http.StatusForbidden, "forbidden", "当前服务禁止通过 IP:PORT 访问，请使用域名访问")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func normalizeRequestHost(raw string) string {
	host := strings.TrimSpace(raw)
	if host == "" {
		return ""
	}

	// RFC 3986 IPv6: [2001:db8::1]:443 或 [2001:db8::1]
	if strings.HasPrefix(host, "[") {
		if idx := strings.Index(host, "]"); idx > 1 {
			return strings.TrimSpace(host[1:idx])
		}
	}

	if h, _, err := net.SplitHostPort(host); err == nil {
		return strings.TrimSpace(h)
	}

	// 未带方括号的 IPv6 字面量（例如 ::1）不应再按 host:port 拆分
	if strings.Count(host, ":") > 1 {
		return host
	}

	// 处理 host:port（非 IPv6）
	if idx := strings.LastIndex(host, ":"); idx > 0 {
		portPart := strings.TrimSpace(host[idx+1:])
		if _, err := strconv.Atoi(portPart); err == nil {
			return strings.TrimSpace(host[:idx])
		}
	}

	return host
}

func isIPLiteralHost(raw string) bool {
	host := strings.TrimSpace(raw)
	if host == "" {
		return false
	}
	host = strings.TrimSuffix(host, ".")
	return net.ParseIP(host) != nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string, msg string) {
	writeJSON(w, status, map[string]any{
		"error":   code,
		"message": msg,
	})
}
