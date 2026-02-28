import { useEffect, useCallback, useMemo, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  MoreVertical,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Image as ImageIcon,
  Music2,
  File,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Dropdown as HeroDropdown, Label as HeroLabel } from '@heroui/react';
import type { FileItem } from '@/types';
import { formatFileSize, formatDateTime } from '@/utils/formatters';
import { ActionIconButton } from '@/components/ui/HeroActionPrimitives';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

const PREVIEW_MODAL_EXIT_MS = 180;

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
  file: incomingFile,
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
  const [activeFile, setActiveFile] = useState<FileItem | null>(incomingFile);
  const [isMounted, setIsMounted] = useState(open && Boolean(incomingFile));
  const [isClosing, setIsClosing] = useState(false);

  const file = incomingFile ?? activeFile;

  useEffect(() => {
    if (open && incomingFile) {
      setActiveFile(incomingFile);
      setIsMounted(true);
      setIsClosing(false);
      return;
    }

    if (!isMounted) return;

    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      setActiveFile(null);
    }, PREVIEW_MODAL_EXIT_MS);

    return () => window.clearTimeout(timer);
  }, [incomingFile, isMounted, open]);

  // 重置状态
  useEffect(() => {
    if (open && incomingFile) {
      setZoom(1);
      setRotation(0);
      setDocumentText(null);
      setDocumentLoading(false);
    }
  }, [incomingFile, open]);

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
      (file.mimeType?.startsWith('text/') ?? false) || /\.(md|txt|json|xml|yaml|yml)$/i.test(file.name);

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
    [navigateNext, navigatePrev, onClose, open],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 禁止背景滚动
  useEffect(() => {
    if (open || isMounted) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMounted, open]);

  if (!isMounted || !file) return null;

  // 渲染预览内容
  const renderPreview = () => {
    switch (file.type) {
      case 'image':
        if (!previewUrl && !file.thumbnail) {
          return (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                <ImageIcon className="h-10 w-10 text-white/70" />
              </div>
              <p className="text-neutral-400">暂无可用预览数据</p>
            </div>
          );
        }
        return (
          <img
            src={previewUrl || file.thumbnail}
            alt={file.name}
            className="max-h-full max-w-full object-contain transition-transform duration-200"
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
          <video src={previewUrl} controls className="max-h-full max-w-full">
            您的浏览器不支持视频播放
          </video>
        );

      case 'audio':
        if (!previewUrl) {
          return <p className="text-neutral-400">暂无可用预览数据（需要先上传或接入后端）</p>;
        }
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-primary-strong)]">
              <Music2 className="h-11 w-11 text-neutral-900" />
            </div>
            <audio src={previewUrl} controls className="w-full max-w-80">
              您的浏览器不支持音频播放
            </audio>
          </div>
        );

      case 'document':
        if (file.mimeType === 'application/pdf') {
          if (!previewUrl) {
            return <p className="text-neutral-400">暂无可用预览数据（需要先上传或接入后端）</p>;
          }
          return <iframe src={previewUrl} className="h-full w-full" title={file.name} />;
        }
        if (documentLoading) {
          return <p className="text-neutral-400">正在加载文档内容...</p>;
        }
        if (documentText) {
          return (
            <div className="max-h-[80vh] max-w-2xl overflow-auto rounded-xl bg-white p-6 dark:bg-neutral-800">
              <pre className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">{documentText}</pre>
            </div>
          );
        }
        return (
          <div className="max-h-[80vh] max-w-2xl overflow-auto rounded-xl bg-white p-6 dark:bg-neutral-800">
            <pre className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              文档暂不可预览（需要先上传或接入后端）。
            </pre>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <File className="h-10 w-10 text-white/70" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">{file.name}</h3>
            <p className="text-neutral-400">此文件类型暂不支持预览</p>
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-slate-950/96',
        isClosing ? 'animate-modalOverlayOut' : 'animate-modalOverlayIn',
      )}
    >
      <div
        className={cn('relative flex h-full flex-col', isClosing ? 'animate-modalPanelOut' : 'animate-modalPanelIn')}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/65 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <ActionIconButton
              icon={<X className="h-5 w-5" />}
              label="关闭预览"
              surface="dark"
              onPress={onClose}
              className="shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <h2 className="truncate font-medium text-white">{file.name}</h2>
              <p className="truncate text-sm text-neutral-400">
                {formatFileSize(file.size)} · {formatDateTime(file.updatedAt)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {file.type === 'image' && (
              <div className="hidden items-center gap-2 sm:flex">
                <ActionIconButton
                  icon={<ZoomOut className="h-5 w-5" />}
                  label="缩小"
                  surface="dark"
                  onPress={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                />
                <span className="min-w-[3rem] text-center text-sm text-white">{Math.round(zoom * 100)}%</span>
                <ActionIconButton
                  icon={<ZoomIn className="h-5 w-5" />}
                  label="放大"
                  surface="dark"
                  onPress={() => setZoom((z) => Math.min(z + 0.25, 3))}
                />
                <ActionIconButton
                  icon={<RotateCw className="h-5 w-5" />}
                  label="旋转"
                  surface="dark"
                  onPress={() => setRotation((r) => r + 90)}
                />
                <div className="mx-2 h-6 w-px bg-white/20" />
              </div>
            )}

            <HeroDropdown>
              <HeroDropdown.Trigger>
                <ActionIconButton icon={<MoreVertical className="h-5 w-5" />} label="更多操作" surface="dark" />
              </HeroDropdown.Trigger>
              <HeroDropdown.Popover className="popover-warm w-44 rounded-2xl">
                <HeroDropdown.Menu
                  aria-label="文件预览操作"
                  onAction={(key) => {
                    if (key === 'download') {
                      onDownload?.(file);
                    }
                    if (key === 'share') {
                      onShare?.(file);
                    }
                  }}
                >
                  <HeroDropdown.Item
                    id="download"
                    textValue="下载文件"
                    isDisabled={!onDownload}
                    className="rounded-xl transition-colors duration-200 data-[hover=true]:bg-white/60 data-[hover=true]:text-neutral-900 dark:data-[hover=true]:bg-white/10 dark:data-[hover=true]:text-white"
                  >
                    <Download className="h-4 w-4 text-current" />
                    <HeroLabel>下载文件</HeroLabel>
                  </HeroDropdown.Item>
                  <HeroDropdown.Item
                    id="share"
                    textValue="分享文件"
                    isDisabled={!onShare}
                    className="rounded-xl transition-colors duration-200 data-[hover=true]:bg-white/60 data-[hover=true]:text-neutral-900 dark:data-[hover=true]:bg-white/10 dark:data-[hover=true]:text-white"
                  >
                    <Share2 className="h-4 w-4 text-current" />
                    <HeroLabel>分享文件</HeroLabel>
                  </HeroDropdown.Item>
                </HeroDropdown.Menu>
              </HeroDropdown.Popover>
            </HeroDropdown>
          </div>
        </div>

        {/* 预览内容 */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">{renderPreview()}</div>

        {/* 导航按钮 */}
        {files.length > 1 && (
          <>
            <div className="absolute top-1/2 left-2 -translate-y-1/2 sm:left-4">
              <ActionIconButton
                icon={<ChevronLeft className="h-6 w-6" />}
                label="上一个文件"
                surface="dark"
                density="cozy"
                onPress={navigatePrev}
                isDisabled={!hasPrev}
                className={cn('rounded-full bg-slate-900/65 backdrop-blur', !hasPrev && 'opacity-40')}
              />
            </div>
            <div className="absolute top-1/2 right-2 -translate-y-1/2 sm:right-4">
              <ActionIconButton
                icon={<ChevronRight className="h-6 w-6" />}
                label="下一个文件"
                surface="dark"
                density="cozy"
                onPress={navigateNext}
                isDisabled={!hasNext}
                className={cn('rounded-full bg-slate-900/65 backdrop-blur', !hasNext && 'opacity-40')}
              />
            </div>
          </>
        )}

        {/* 底部信息 */}
        {files.length > 1 && (
          <div className="border-t border-white/10 py-3 text-center text-sm text-neutral-400">
            {currentIndex + 1} / {files.length}
          </div>
        )}
      </div>
    </div>
  );
}
