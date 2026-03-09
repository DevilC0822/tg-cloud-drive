package store

import "testing"

func TestNewPathPrefixFilter(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		prefix    string
		wantExact []string
		wantLike  []string
		wantErr   bool
	}{
		{
			name:      "normalized path",
			prefix:    "/albums/2026",
			wantExact: []string{"/albums/2026", "albums/2026"},
			wantLike:  []string{"/albums/2026/%", "albums/2026/%"},
		},
		{
			name:      "legacy path without leading slash",
			prefix:    "albums/2026",
			wantExact: []string{"/albums/2026", "albums/2026"},
			wantLike:  []string{"/albums/2026/%", "albums/2026/%"},
		},
		{
			name:      "root path",
			prefix:    "/",
			wantExact: []string{"/"},
			wantLike:  []string{"/%"},
		},
		{
			name:    "empty path",
			prefix:  "   ",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			filter, err := newPathPrefixFilter(tt.prefix)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			assertStringSliceEqual(t, filter.exact, tt.wantExact)
			assertStringSliceEqual(t, filter.like, tt.wantLike)
		})
	}
}

func TestBuildChildPath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		parentPath string
		childName  string
		want       string
	}{
		{
			name:       "root child stays normalized",
			parentPath: "/",
			childName:  "photos",
			want:       "/photos",
		},
		{
			name:       "nested child keeps rooted path",
			parentPath: "/photos",
			childName:  "2026",
			want:       "/photos/2026",
		},
		{
			name:       "legacy parent path is normalized",
			parentPath: "photos",
			childName:  "2026",
			want:       "/photos/2026",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := BuildChildPath(tt.parentPath, tt.childName); got != tt.want {
				t.Fatalf("BuildChildPath(%q, %q) = %q, want %q", tt.parentPath, tt.childName, got, tt.want)
			}
		})
	}
}

func assertStringSliceEqual(t *testing.T, got []string, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("length mismatch: got %v want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("value mismatch at %d: got %v want %v", i, got, want)
		}
	}
}
