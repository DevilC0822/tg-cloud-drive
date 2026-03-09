package api

import "testing"

func TestShouldCleanupUploadFolderOrphans(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		rootPath  string
		conflicts []string
		want      bool
	}{
		{
			name:      "descendants only",
			rootPath:  "/测试上传嵌套",
			conflicts: []string{"/测试上传嵌套/.DS_Store", "/测试上传嵌套/内层 1/a.torrent"},
			want:      true,
		},
		{
			name:      "descendants only legacy path",
			rootPath:  "/测试上传嵌套",
			conflicts: []string{"测试上传嵌套/.DS_Store", "测试上传嵌套/内层 1/a.torrent"},
			want:      true,
		},
		{
			name:      "root exists",
			rootPath:  "/测试上传嵌套",
			conflicts: []string{"/测试上传嵌套", "/测试上传嵌套/.DS_Store"},
			want:      false,
		},
		{
			name:      "outside subtree",
			rootPath:  "/测试上传嵌套",
			conflicts: []string{"/其他目录/.DS_Store"},
			want:      false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := shouldCleanupUploadFolderOrphans(tc.rootPath, tc.conflicts); got != tc.want {
				t.Fatalf("shouldCleanupUploadFolderOrphans() = %v, want %v", got, tc.want)
			}
		})
	}
}
