import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Archive, Code, File, FileText, Folder, Image, Music, Video } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { FileItem, FileType } from '@/types';

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

const fileIcons: Record<FileType, ComponentType<{ className?: string }>> = {
  folder: Folder,
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  archive: Archive,
  code: Code,
  other: File,
};

const fileColors: Record<FileType, string> = {
  folder: 'text-orange-500',
  image: 'text-pink-500',
  video: 'text-purple-500',
  audio: 'text-green-500',
  document: 'text-blue-500',
  archive: 'text-orange-500',
  code: 'text-cyan-500',
  other: 'text-neutral-500',
};

type ThumbnailSize = 'card' | 'row';

export interface FileThumbnailProps {
  file: FileItem;
  size?: ThumbnailSize;
}

function iconSizeClass(size: ThumbnailSize): string {
  return size === 'card' ? 'w-16 h-16' : 'w-10 h-10 p-2';
}

function wrapperSizeClass(size: ThumbnailSize): string {
  return size === 'card' ? 'w-full h-full rounded-xl' : 'w-10 h-10 rounded-lg';
}

function buildPreviewSrc(file: FileItem): string | undefined {
  const updatedAtTs = new Date(file.updatedAt).getTime();
  const version = Number.isNaN(updatedAtTs) ? 0 : updatedAtTs;
  if (file.type === 'image') {
    return `/api/items/${file.id}/content?v=${version}`;
  }
  if (file.type === 'video') {
    return `/api/items/${file.id}/thumbnail?v=${version}`;
  }
  return undefined;
}

export function FileThumbnail({ file, size = 'card' }: FileThumbnailProps) {
  const Icon = fileIcons[file.type];
  const iconColor = fileColors[file.type];
  const previewSrc = useMemo(() => buildPreviewSrc(file), [file.id, file.type, new Date(file.updatedAt).getTime()]);
  const [mediaError, setMediaError] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setMediaError(false);
    setMediaLoaded(false);
  }, [previewSrc]);

  useEffect(() => {
    if (!previewSrc) return;
    const img = imageRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setMediaError(false);
      setMediaLoaded(true);
    }
  }, [previewSrc]);

  if (previewSrc && !mediaError && (file.type === 'image' || file.type === 'video')) {
    return (
      <div className={cn(wrapperSizeClass(size), 'relative overflow-hidden bg-neutral-100 dark:bg-neutral-800')}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={cn(iconSizeClass(size), iconColor)} />
        </div>
        <img
          ref={imageRef}
          src={previewSrc}
          alt={file.name}
          loading="lazy"
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            mediaLoaded ? 'opacity-100' : 'opacity-0',
          )}
          onLoad={() => setMediaLoaded(true)}
          onError={() => {
            setMediaError(true);
            setMediaLoaded(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn(wrapperSizeClass(size), 'flex items-center justify-center bg-neutral-100 dark:bg-neutral-800')}>
      <Icon className={cn(iconSizeClass(size), iconColor)} />
    </div>
  );
}
