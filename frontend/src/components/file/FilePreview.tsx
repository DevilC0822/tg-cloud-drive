import { useEffect, useCallback, useMemo, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem } from '@/types';
import { formatFileSize, formatDateTime } from '@/utils/formatters';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

export interface FilePreviewProps {
  open: boolean;
  file: FileItem | null;
  files?: FileItem[]; // 用于切换上一个/下一个
  onClose: () => void;
  onNavigate?: (file: FileItem) => void;
  getPreviewUrl?: (file: FileItem) => string | undefined;
  onDownload?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
}

export function FilePreview({
  open,
  file,
  files = [],
  onClose,
  onNavigate,
  getPreviewUrl,
  onDownload,
  onShare,
}: FilePreviewProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);

  // 重置状态
  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setDocumentText(null);
      setDocumentLoading(false);
    }
  }, [open, file]);

  const previewUrl = useMemo(() => {
    if (!file) return undefined;
    return getPreviewUrl?.(file);
  }, [file, getPreviewUrl]);

  // 获取当前文件索引
  const currentIndex = useMemo(() => {
    if (!file) return -1;
    return files.findIndex((f) => f.id === file.id);
  }, [file, files]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < files.length - 1;

  const navigatePrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      onNavigate(files[currentIndex - 1]);
    }
  }, [currentIndex, files, hasPrev, onNavigate]);

  const navigateNext = useCallback(() => {
    if (hasNext && onNavigate) {
      onNavigate(files[currentIndex + 1]);
    }
  }, [currentIndex, files, hasNext, onNavigate]);

  // 文档（文本类）预览加载
  useEffect(() => {
    if (!open || !file) return;
    if (file.type !== 'document') return;

    const isTextLike =
      (file.mimeType?.startsWith('text/') ?? false) ||
      /\.(md|txt|json|xml|yaml|yml)$/i.test(file.name);

    if (!previewUrl || !isTextLike || file.mimeType === 'application/pdf') {
      setDocumentText(null);
      setDocumentLoading(false);
      return;
    }

    const controller = new AbortController();
    setDocumentLoading(true);
    setDocumentText(null);

    fetch(previewUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('加载失败');
        return res.text();
      })
      .then((text) => setDocumentText(text))
      .catch(() => {
        // 忽略错误，回退到占位提示
        setDocumentText(null);
      })
      .finally(() => setDocumentLoading(false));

    return () => controller.abort();
  }, [file, open, previewUrl]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          navigatePrev();
          break;
        case 'ArrowRight':
          navigateNext();
          break;
        case '+':
        case '=':
          setZoom((z) => Math.min(z + 0.25, 3));
          break;
        case '-':
          setZoom((z) => Math.max(z - 0.25, 0.5));
          break;
      }
    },
    [navigateNext, navigatePrev, onClose, open]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 禁止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open || !file) return null;

  // 渲染预览内容
  const renderPreview = () => {
    switch (file.type) {
      case 'image':
        if (!previewUrl && !file.thumbnail) {
          return (
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-neutral-100/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🖼️</span>
              </div>
              <p className="text-neutral-400">暂无可用预览数据</p>
            </div>
          );
        }
        return (
          <img
            src={previewUrl || file.thumbnail}
            alt={file.name}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        );

      case 'video':
        if (!previewUrl) {
          return <p className="text-neutral-400">暂无可用预览数据（需要先上传或接入后端）</p>;
        }
        return (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-full"
          >
            您的浏览器不支持视频播放
          </video>
        );

      case 'audio':
        if (!previewUrl) {
          return <p className="text-neutral-400">暂无可用预览数据（需要先上传或接入后端）</p>;
        }
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center">
              <span className="text-4xl">🎵</span>
            </div>
            <audio src={previewUrl} controls className="w-80">
              您的浏览器不支持音频播放
            </audio>
          </div>
        );

      case 'document':
        if (file.mimeType === 'application/pdf') {
          if (!previewUrl) {
            return <p className="text-neutral-400">暂无可用预览数据（需要先上传或接入后端）</p>;
          }
          return (
            <iframe
              src={previewUrl}
              className="w-full h-full"
              title={file.name}
            />
          );
        }
        if (documentLoading) {
          return <p className="text-neutral-400">正在加载文档内容...</p>;
        }
        if (documentText) {
          return (
            <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-2xl max-h-[80vh] overflow-auto">
              <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                {documentText}
              </pre>
            </div>
          );
        }
        return (
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-2xl max-h-[80vh] overflow-auto">
            <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              文档暂不可预览（需要先上传或接入后端）。
            </pre>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="w-24 h-24 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📄</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{file.name}</h3>
            <p className="text-neutral-400">此文件类型暂不支持预览</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fadeIn">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-white font-medium">{file.name}</h2>
            <p className="text-sm text-neutral-400">
              {formatFileSize(file.size)} · {formatDateTime(file.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 图片专用工具 */}
          {file.type === 'image' && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                title="缩小"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-white text-sm min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                title="放大"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setRotation((r) => r + 90)}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
                title="旋转"
              >
                <RotateCw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-2" />
            </>
          )}

          <button
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title="下载"
            onClick={() => onDownload?.(file)}
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            title="分享"
            onClick={() => onShare?.(file)}
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 预览内容 */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {renderPreview()}
      </div>

      {/* 导航按钮 */}
      {files.length > 1 && (
        <>
          <button
            onClick={navigatePrev}
            disabled={!hasPrev}
            className={cn(
              'absolute left-4 top-1/2 -translate-y-1/2',
              'p-3 rounded-full bg-black/50 text-white',
              'transition-all duration-200',
              hasPrev ? 'hover:bg-black/70' : 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={navigateNext}
            disabled={!hasNext}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2',
              'p-3 rounded-full bg-black/50 text-white',
              'transition-all duration-200',
              hasNext ? 'hover:bg-black/70' : 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* 底部信息 */}
      {files.length > 1 && (
        <div className="text-center py-3 text-neutral-400 text-sm">
          {currentIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
}
