import { atom } from 'jotai';

/* 是否完成鉴权状态检查 */
export const authCheckedAtom = atom<boolean>(false);

/* 是否已登录（Cookie 鉴权） */
export const authenticatedAtom = atom<boolean>(false);
