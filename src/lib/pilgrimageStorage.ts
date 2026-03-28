import type {
  PilgrimageStamp,
  PilgrimageStampMap,
  PilgrimageUiState,
  PilgrimageWish,
  PilgrimageWishMap,
  PilgrimageWishSlots,
} from './types';

export const PILGRIMAGE_STORAGE_KEYS = {
  stamps: 'maili:pilgrimage:stamps:v1',
  wishes: 'maili:pilgrimage:wishes:v1',
  uiState: 'maili:pilgrimage:ui-state:v1',
} as const;

const EMPTY_WISH_SLOTS: PilgrimageWishSlots = {
  1: null,
  2: null,
  3: null,
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readStorage<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to read storage key: ${key}`, error);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore cleanup failure
    }
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (!canUseStorage()) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to write storage key: ${key}`, error);
    return false;
  }
}

function parishKey(parishId: number) {
  return String(parishId);
}

function buildEmptyWishSlots(): PilgrimageWishSlots {
  return { ...EMPTY_WISH_SLOTS };
}

export function getPilgrimageStamps(): PilgrimageStampMap {
  return readStorage<PilgrimageStampMap>(PILGRIMAGE_STORAGE_KEYS.stamps, {});
}

export function getPilgrimageStamp(parishId: number): PilgrimageStamp | null {
  return getPilgrimageStamps()[parishKey(parishId)] ?? null;
}

export function hasPilgrimageStamp(parishId: number) {
  return Boolean(getPilgrimageStamp(parishId));
}

export function savePilgrimageStamp(input: PilgrimageStamp) {
  const stamps = getPilgrimageStamps();
  stamps[parishKey(input.parish_id)] = input;
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.stamps, stamps);
}

export function removePilgrimageStamp(parishId: number) {
  const stamps = getPilgrimageStamps();
  delete stamps[parishKey(parishId)];
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.stamps, stamps);
}

export function clearPilgrimageStamps() {
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.stamps, {});
}

export function getPilgrimageStampCount() {
  return Object.keys(getPilgrimageStamps()).length;
}

export function getPilgrimageWishes(): PilgrimageWishMap {
  return readStorage<PilgrimageWishMap>(PILGRIMAGE_STORAGE_KEYS.wishes, {});
}

export function getPilgrimageWishesByParish(parishId: number): PilgrimageWishSlots {
  return getPilgrimageWishes()[parishKey(parishId)] ?? buildEmptyWishSlots();
}

export function savePilgrimageWish(parishId: number, slot: 1 | 2 | 3, wish: PilgrimageWish) {
  if (!hasPilgrimageStamp(parishId)) {
    return false;
  }

  const wishes = getPilgrimageWishes();
  const key = parishKey(parishId);
  const slots = wishes[key] ?? buildEmptyWishSlots();
  slots[slot] = wish;
  wishes[key] = slots;
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.wishes, wishes);
}

export function clearPilgrimageWish(parishId: number, slot: 1 | 2 | 3) {
  const wishes = getPilgrimageWishes();
  const key = parishKey(parishId);
  const slots = wishes[key];

  if (!slots) return true;

  slots[slot] = null;

  if (!slots[1] && !slots[2] && !slots[3]) {
    delete wishes[key];
  } else {
    wishes[key] = slots;
  }

  return writeStorage(PILGRIMAGE_STORAGE_KEYS.wishes, wishes);
}

export function clearPilgrimageWishes() {
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.wishes, {});
}

export function getPilgrimageUiState(): PilgrimageUiState {
  return readStorage<PilgrimageUiState>(PILGRIMAGE_STORAGE_KEYS.uiState, {});
}

export function setPilgrimageUiState(patch: Partial<PilgrimageUiState>) {
  const current = getPilgrimageUiState();
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.uiState, { ...current, ...patch });
}

export function clearPilgrimageUiState() {
  return writeStorage(PILGRIMAGE_STORAGE_KEYS.uiState, {});
}
