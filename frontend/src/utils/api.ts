import type { FileItem, FileType } from '@/types';

interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: unknown;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  payload?: ApiErrorResponse;

  constructor(message: string, status: number, code?: string, payload?: ApiErrorResponse) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  const status = res.status;
  try {
    const data = (await res.json()) as ApiErrorResponse;
    return new ApiError(data.message || `请求失败（${status}）`, status, data.error, data);
  } catch {
    return new ApiError(`请求失败（${status}）`, status);
  }
}

export async function apiFetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }
  return (await res.json()) as T;
}

export interface ItemDTO {
  id: string;
  type: string;
  name: string;
  parentId: string | null;
  path: string;
  size: number;
  mimeType?: string | null;
  isVaulted?: boolean;
  isShared: boolean;
  sharedCode?: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string | null;
}

export function dtoToFileItem(dto: ItemDTO): FileItem {
  const type = (dto.type || 'other') as FileType;
  return {
    id: dto.id,
    name: dto.name,
    type,
    size: dto.size ?? 0,
    mimeType: dto.mimeType ?? undefined,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    lastAccessedAt: dto.lastAccessedAt ? new Date(dto.lastAccessedAt) : null,
    parentId: dto.parentId ?? null,
    path: dto.path,
    isVaulted: !!dto.isVaulted,
    isShared: !!dto.isShared,
    shareCode: dto.sharedCode ?? null,
  };
}
