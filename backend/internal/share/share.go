package share

import (
	"crypto/rand"
	"errors"
)

const base62Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// GenerateCode 生成不可猜测的短码（base62）。
// 使用拒绝采样避免 modulo bias；用于分享链接短码足够安全。
func GenerateCode(length int) (string, error) {
	if length <= 0 || length > 64 {
		return "", errors.New("share code 长度非法")
	}

	out := make([]byte, 0, length)
	buf := make([]byte, 32)
	for len(out) < length {
		if _, err := rand.Read(buf); err != nil {
			return "", err
		}
		for _, b := range buf {
			// 62 * 4 = 248，小于 248 的值可以均匀映射到 0..61
			if b >= 248 {
				continue
			}
			out = append(out, base62Alphabet[int(b)%62])
			if len(out) >= length {
				break
			}
		}
	}

	return string(out), nil
}

