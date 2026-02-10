package api

import (
	"fmt"
	"net/url"
	"strings"
	"unicode/utf8"
)

func isPreviewableMime(mimeType string) bool {
	mt := strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.HasPrefix(mt, "image/"):
		return true
	case strings.HasPrefix(mt, "text/"):
		return true
	case strings.HasPrefix(mt, "audio/"):
		return true
	case strings.HasPrefix(mt, "video/"):
		return true
	case mt == "application/pdf":
		return true
	default:
		return false
	}
}

func sanitizeFilenameForHeader(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "file"
	}
	// 禁止路径穿越/分隔符
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	name = strings.ReplaceAll(name, "\"", "'")
	name = strings.ReplaceAll(name, "\r", "")
	name = strings.ReplaceAll(name, "\n", "")
	return name
}

func asciiFallbackFilename(name string) string {
	name = sanitizeFilenameForHeader(name)
	var b strings.Builder
	b.Grow(len(name))
	for _, r := range name {
		if r >= 0x20 && r <= 0x7e && r != '"' && r != '\\' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	out := strings.TrimSpace(b.String())
	if out == "" {
		return "file"
	}
	return out
}

func contentDisposition(name string, inline bool) string {
	directive := "attachment"
	if inline {
		directive = "inline"
	}

	name = sanitizeFilenameForHeader(name)
	fallback := asciiFallbackFilename(name)
	encoded := ""
	if utf8.ValidString(name) {
		// RFC 5987: filename*=UTF-8''<percent-encoded>
		encoded = url.PathEscape(name)
	} else {
		encoded = url.PathEscape(fallback)
	}

	return fmt.Sprintf("%s; filename=\"%s\"; filename*=UTF-8''%s", directive, fallback, encoded)
}

