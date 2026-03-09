package api

import (
	"testing"

	"tg-cloud-drive-api/internal/store"
)

func TestBuildUploadFolderConflictMessage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		items []store.Item
		want  string
	}{
		{
			name: "generic when empty",
			want: uploadFolderConflictGenericMsg,
		},
		{
			name: "visible conflict",
			items: []store.Item{
				{Path: "/测试上传嵌套", InVault: false},
			},
			want: "目标位置存在同名文件或文件夹：/测试上传嵌套，目录上传已整体取消",
		},
		{
			name: "vault only conflict",
			items: []store.Item{
				{Path: "/测试上传嵌套", InVault: true},
			},
			want: "目标位置存在同名密码箱文件或文件夹：/测试上传嵌套（密码箱）。当前文件视图不会显示密码箱项目，目录上传已整体取消",
		},
		{
			name: "mixed conflict",
			items: []store.Item{
				{Path: "/测试上传嵌套", InVault: false},
				{Path: "/测试上传嵌套/内层 1", InVault: true},
			},
			want: "目标位置存在同名文件或文件夹（含密码箱项目）：/测试上传嵌套、/测试上传嵌套/内层 1（密码箱），目录上传已整体取消",
		},
		{
			name: "preview limit",
			items: []store.Item{
				{Path: "/a", InVault: false},
				{Path: "/b", InVault: false},
				{Path: "/c", InVault: false},
				{Path: "/d", InVault: false},
			},
			want: "目标位置存在同名文件或文件夹：/a、/b、/c 等 4 项，目录上传已整体取消",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := buildUploadFolderConflictMessage(tc.items); got != tc.want {
				t.Fatalf("message = %q, want %q", got, tc.want)
			}
		})
	}
}
