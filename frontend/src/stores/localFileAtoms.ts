import { atom } from 'jotai';

export interface LocalFileData {
  file: File;
  url: string; // Object URL（URL.createObjectURL）
}

/**
 * 本地上传文件的内存存储
 * - 仅用于“前端纯本地”模式下的真实预览/下载
 * - 注意：url 需要在永久删除时 revoke，避免内存泄漏
 */
export const localFileDataAtom = atom<Map<string, LocalFileData>>(new Map());

