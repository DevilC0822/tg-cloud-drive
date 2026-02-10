package torrent

import "testing"

type bdictEntry struct {
	key string
	val any
}

func bencodeValue(v any) string {
	switch val := v.(type) {
	case string:
		return itoa(len(val)) + ":" + val
	case int:
		return "i" + itoa(val) + "e"
	case int64:
		return "i" + itoa64(val) + "e"
	case []any:
		out := "l"
		for _, item := range val {
			out += bencodeValue(item)
		}
		return out + "e"
	case []bdictEntry:
		out := "d"
		for _, item := range val {
			out += bencodeValue(item.key)
			out += bencodeValue(item.val)
		}
		return out + "e"
	default:
		panic("unsupported bencode type")
	}
}

func itoa(v int) string {
	if v == 0 {
		return "0"
	}
	negative := v < 0
	if negative {
		v = -v
	}
	buf := make([]byte, 0, 16)
	for v > 0 {
		buf = append(buf, byte('0'+(v%10)))
		v /= 10
	}
	if negative {
		buf = append(buf, '-')
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}

func itoa64(v int64) string {
	if v == 0 {
		return "0"
	}
	negative := v < 0
	if negative {
		v = -v
	}
	buf := make([]byte, 0, 24)
	for v > 0 {
		buf = append(buf, byte('0'+(v%10)))
		v /= 10
	}
	if negative {
		buf = append(buf, '-')
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}

func TestParseMetaInfoSingleFile(t *testing.T) {
	t.Parallel()

	raw := bencodeValue([]bdictEntry{
		{key: "announce", val: "https://tracker.example.com/announce"},
		{
			key: "info",
			val: []bdictEntry{
				{key: "length", val: 123},
				{key: "name", val: "test.mp4"},
				{key: "piece length", val: 16384},
				{key: "pieces", val: "12345678901234567890"},
				{key: "private", val: 1},
			},
		},
	})

	meta, err := ParseMetaInfo([]byte(raw))
	if err != nil {
		t.Fatalf("ParseMetaInfo() error = %v", err)
	}
	if meta.Name != "test.mp4" {
		t.Fatalf("meta.Name = %q, want %q", meta.Name, "test.mp4")
	}
	if meta.TotalSize != 123 {
		t.Fatalf("meta.TotalSize = %d, want %d", meta.TotalSize, 123)
	}
	if !meta.IsPrivate {
		t.Fatal("meta.IsPrivate should be true")
	}
	if len(meta.Files) != 1 {
		t.Fatalf("meta.Files len = %d, want 1", len(meta.Files))
	}
	if meta.Files[0].Path != "test.mp4" {
		t.Fatalf("meta.Files[0].Path = %q, want %q", meta.Files[0].Path, "test.mp4")
	}
	if len(meta.AnnounceHosts) != 1 || meta.AnnounceHosts[0] != "tracker.example.com" {
		t.Fatalf("meta.AnnounceHosts = %#v, want [tracker.example.com]", meta.AnnounceHosts)
	}
	if len(meta.InfoHash) != 40 {
		t.Fatalf("meta.InfoHash len = %d, want 40", len(meta.InfoHash))
	}
}

func TestParseMetaInfoMultiFile(t *testing.T) {
	t.Parallel()

	raw := bencodeValue([]bdictEntry{
		{key: "announce", val: "https://pt.example.com/announce"},
		{
			key: "info",
			val: []bdictEntry{
				{
					key: "files",
					val: []any{
						[]bdictEntry{
							{key: "length", val: 10},
							{key: "path", val: []any{"a.txt"}},
						},
						[]bdictEntry{
							{key: "length", val: 20},
							{key: "path", val: []any{"sub", "b.mkv"}},
						},
					},
				},
				{key: "name", val: "root"},
				{key: "piece length", val: 16384},
				{key: "pieces", val: "12345678901234567890"},
			},
		},
	})

	meta, err := ParseMetaInfo([]byte(raw))
	if err != nil {
		t.Fatalf("ParseMetaInfo() error = %v", err)
	}
	if meta.TotalSize != 30 {
		t.Fatalf("meta.TotalSize = %d, want %d", meta.TotalSize, 30)
	}
	if len(meta.Files) != 2 {
		t.Fatalf("meta.Files len = %d, want 2", len(meta.Files))
	}
	if meta.Files[0].Path != "a.txt" {
		t.Fatalf("meta.Files[0].Path = %q, want %q", meta.Files[0].Path, "a.txt")
	}
	if meta.Files[1].Path != "sub/b.mkv" {
		t.Fatalf("meta.Files[1].Path = %q, want %q", meta.Files[1].Path, "sub/b.mkv")
	}
}

func TestValidateAnnounceHosts(t *testing.T) {
	t.Parallel()

	err := ValidateAnnounceHosts(
		[]string{"tracker.example.com"},
		[]string{"example.com"},
	)
	if err != nil {
		t.Fatalf("ValidateAnnounceHosts() unexpected error: %v", err)
	}

	err = ValidateAnnounceHosts(
		[]string{"tracker.other.com"},
		[]string{"example.com"},
	)
	if err == nil {
		t.Fatal("ValidateAnnounceHosts() should fail for disallowed domain")
	}
}

func TestParseMetaInfoInvalid(t *testing.T) {
	t.Parallel()

	if _, err := ParseMetaInfo([]byte("not-bencode")); err == nil {
		t.Fatal("ParseMetaInfo() should fail for invalid input")
	}
}
