package api

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var (
	errInvalidRangeHeader     = errors.New("Range 头非法")
	errRangeNotSatisfiable    = errors.New("Range 不可满足")
	errMultipleRangesNotAllow = errors.New("不支持多段 Range")
)

type byteRange struct {
	Start int64 // inclusive
	End   int64 // inclusive
}

func parseSingleRange(rangeHeader string, size int64) (br byteRange, partial bool, err error) {
	if size < 0 {
		return byteRange{}, false, fmt.Errorf("size 非法: %d", size)
	}

	raw := strings.TrimSpace(rangeHeader)
	if raw == "" {
		if size == 0 {
			return byteRange{Start: 0, End: -1}, false, nil
		}
		return byteRange{Start: 0, End: size - 1}, false, nil
	}

	if size == 0 {
		return byteRange{}, true, errRangeNotSatisfiable
	}

	if !strings.HasPrefix(raw, "bytes=") {
		return byteRange{}, true, errInvalidRangeHeader
	}
	spec := strings.TrimSpace(strings.TrimPrefix(raw, "bytes="))
	if spec == "" {
		return byteRange{}, true, errInvalidRangeHeader
	}
	if strings.Contains(spec, ",") {
		return byteRange{}, true, errMultipleRangesNotAllow
	}

	dash := strings.Index(spec, "-")
	if dash < 0 {
		return byteRange{}, true, errInvalidRangeHeader
	}

	startRaw := strings.TrimSpace(spec[:dash])
	endRaw := strings.TrimSpace(spec[dash+1:])

	// bytes=-N：最后 N 个字节
	if startRaw == "" {
		if endRaw == "" {
			return byteRange{}, true, errInvalidRangeHeader
		}
		n, err := strconv.ParseInt(endRaw, 10, 64)
		if err != nil || n <= 0 {
			return byteRange{}, true, errInvalidRangeHeader
		}
		if n >= size {
			return byteRange{Start: 0, End: size - 1}, true, nil
		}
		return byteRange{Start: size - n, End: size - 1}, true, nil
	}

	start, err := strconv.ParseInt(startRaw, 10, 64)
	if err != nil || start < 0 {
		return byteRange{}, true, errInvalidRangeHeader
	}

	end := int64(size - 1)
	if endRaw != "" {
		parsedEnd, err := strconv.ParseInt(endRaw, 10, 64)
		if err != nil || parsedEnd < 0 {
			return byteRange{}, true, errInvalidRangeHeader
		}
		end = parsedEnd
	}

	if start >= size {
		return byteRange{}, true, errRangeNotSatisfiable
	}
	if end < start {
		return byteRange{}, true, errInvalidRangeHeader
	}
	if end >= size {
		end = size - 1
	}

	return byteRange{Start: start, End: end}, true, nil
}

