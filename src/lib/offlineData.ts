import Fuse from 'fuse.js';
import { RRule, datetime } from 'rrule';
import type { MassTime, OfflineSyncState, ParishDetail, ParishPhoto, ParishSummary, Priest, UpcomingMass } from './types';

const LANGUAGE_NAMES: Record<string, string> = {
  ja: '日語', ko: '韓語', zh: '國語', 'zh-TW': '國語', 'zh-CN': '普通話',
  en: '英語', vi: '越南語', fr: '法語', la: '拉丁語',
  pt: '葡萄牙語', es: '西班牙語', tl: '他加祿語', id: '印尼語',
};

const SYNC_BASE_URL = 'https://maili-news-scrapper.chihhe.dev';
const SYNC_VERSION_URL = `${SYNC_BASE_URL}/api/v1/sync/version`;
const SYNC_DOWNLOAD_URL = `${SYNC_BASE_URL}/api/v1/sync/download`;
const STORAGE_KEY = 'maili-offline-snapshot-v1';

type OfflineParish = {
  id: number;
  name_zh: string;
  name_local?: string | null;
  name_en?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  fb_url?: string | null;
  ig_url?: string | null;
  other_url?: string | null;
  priest_name?: string | null;
  diocese_id?: number | null;
  deanery_id?: number | null;
  city_id?: number | null;
  has_sub_venues?: boolean;
};

type OfflineMassTime = {
  id: number;
  parish_id: number;
  mass_type_id?: number | null;
  rrule?: string | null;
  duration_minutes?: number | null;
  language?: string | null;
  label?: string | null;
  location_note?: string | null;
  remarks?: string | null;
};

type OfflinePriest = {
  id: number;
  name_zh?: string | null;
  name_en?: string | null;
  title?: string | null;
  image_url?: string | null;
  parish_ids?: number[];
};

type OfflineDiocese = {
  id: number;
  name_zh: string;
  name_en?: string | null;
};

type OfflineLanguage = {
  id: number;
  name_zh: string;
  name_en?: string | null;
};

type OfflineMassType = {
  id: number;
  type_code?: string | null;
  name_zh?: string | null;
  name_en?: string | null;
};

type OfflineSnapshotPayload = {
  version: number;
  updated_at: string;
  data: {
    parishes: OfflineParish[];
    mass_times: OfflineMassTime[];
    dioceses: OfflineDiocese[];
    languages: OfflineLanguage[];
    mass_types: OfflineMassType[];
    priests: OfflinePriest[];
    photos: Array<ParishPhoto & { id?: number; parish_id: number; sort_order?: number | null }>;
  };
};

type OfflineSnapshot = {
  version: number;
  updatedAt: string;
  savedAt: string;
  parishes: OfflineParish[];
  massTimes: OfflineMassTime[];
  dioceses: OfflineDiocese[];
  languages: OfflineLanguage[];
  massTypes: OfflineMassType[];
  priests: OfflinePriest[];
  photos: Array<ParishPhoto & { id?: number; parish_id: number; sort_order?: number | null }>;
};

type ParishSearchDocument = OfflineParish & {
  _dioceseNameZh?: string | null;
  _dioceseNameEn?: string | null;
};

let inMemorySnapshot: OfflineSnapshot | null = null;
let inflightSync: Promise<OfflineSyncState> | null = null;
let initFromStoragePromise: Promise<void> | null = null;
let parishSearchFuse: Fuse<ParishSearchDocument> | null = null;

const GZ_PREFIX = 'gz:';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// --- gzip helpers (CompressionStream available iOS 16.4+, Chrome 80+) ---

async function compressToStorage(json: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return json;
  try {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(json));
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
    }
    return GZ_PREFIX + btoa(binary);
  } catch {
    return json; // fallback: store uncompressed
  }
}

async function decompressFromStorage(raw: string): Promise<string> {
  if (!raw.startsWith(GZ_PREFIX)) return raw; // plain JSON
  if (typeof DecompressionStream === 'undefined') return ''; // can't decompress
  try {
    const binary = atob(raw.slice(GZ_PREFIX.length));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return await new Response(ds.readable).text();
  } catch {
    return '';
  }
}

// --- storage helpers ---

function buildSyncState(
  snapshot: OfflineSnapshot | null,
  overrides: Partial<OfflineSyncState> = {},
): OfflineSyncState {
  return {
    ready: Boolean(snapshot),
    source: snapshot ? 'cache' : 'none',
    version: snapshot?.version ?? null,
    updatedAt: snapshot?.updatedAt ?? null,
    isStale: overrides.isStale ?? false,
    lastSyncAt: snapshot?.savedAt ?? null,
    error: null,
    ...overrides,
  };
}

// Async init: decompress from localStorage into inMemorySnapshot (runs once per session)
async function initFromStorage(): Promise<void> {
  if (inMemorySnapshot || !canUseStorage()) return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const json = await decompressFromStorage(raw);
    if (!json) { localStorage.removeItem(STORAGE_KEY); return; }
    const parsed = JSON.parse(json) as OfflineSnapshot;
    if (!parsed?.version) return;
    inMemorySnapshot = parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// loadSnapshotFromStorage: sync fast-path via inMemorySnapshot (populated by initFromStorage)
function loadSnapshotFromStorage(): OfflineSnapshot | null {
  return inMemorySnapshot;
}

async function saveSnapshot(payload: OfflineSnapshotPayload): Promise<void> {
  const snapshot: OfflineSnapshot = {
    version: payload.version,
    updatedAt: payload.updated_at,
    savedAt: new Date().toISOString(),
    parishes: payload.data.parishes ?? [],
    massTimes: payload.data.mass_times ?? [],
    dioceses: payload.data.dioceses ?? [],
    languages: payload.data.languages ?? [],
    massTypes: payload.data.mass_types ?? [],
    priests: payload.data.priests ?? [],
    photos: payload.data.photos ?? [],
  };
  inMemorySnapshot = snapshot;
  parishSearchFuse = null;

  if (!canUseStorage()) return;
  try {
    const toStore = await compressToStorage(JSON.stringify(snapshot));
    localStorage.removeItem(STORAGE_KEY); // free space before writing
    localStorage.setItem(STORAGE_KEY, toStore);
  } catch {
    // QuotaExceededError even after compression: data lives in memory only this session
    console.warn('localStorage full — snapshot kept in memory only');
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}

// 優先抓 CDN 靜態檔（URL 已帶版本號，瀏覽器可安全 cache），
// CORS 失敗或 404 時 fallback 到 API（有 CORS header）
async function fetchDownloadPayload(version: number): Promise<OfflineSnapshotPayload> {
  const staticUrl = `${SYNC_BASE_URL}/data/sync-v${version}.json`;
  try {
    const res = await fetch(staticUrl);
    if (res.ok) return res.json();
  } catch {
    // CORS / network error on static file → fall through to API
  }
  return fetchJson<OfflineSnapshotPayload>(SYNC_DOWNLOAD_URL, { cache: 'no-store' });
}

export async function ensureOfflineDataFresh(force = false): Promise<OfflineSyncState> {
  if (inflightSync && !force) return inflightSync;

  inflightSync = (async () => {
    // Decompress + load from localStorage on first call
    if (!initFromStoragePromise) initFromStoragePromise = initFromStorage();
    await initFromStoragePromise;

    const snapshot = loadSnapshotFromStorage();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return buildSyncState(snapshot, { isStale: true });
    }

    try {
      const versionInfo = await fetchJson<{ version: number; updated_at: string }>(SYNC_VERSION_URL, { cache: 'no-store' });
      if (!snapshot || force || versionInfo.version > snapshot.version) {
        const payload = await fetchDownloadPayload(versionInfo.version);
        await saveSnapshot(payload);
        return buildSyncState(inMemorySnapshot, { source: 'remote', isStale: false });
      }
      return buildSyncState(snapshot, { source: 'cache', isStale: false });
    } catch (error) {
      if (snapshot) {
        return buildSyncState(snapshot, {
          source: 'cache',
          isStale: true,
          error: error instanceof Error ? error.message : '同步失敗',
        });
      }
      return buildSyncState(null, {
        source: 'none',
        isStale: true,
        error: error instanceof Error ? error.message : '同步失敗',
      });
    } finally {
      inflightSync = null;
    }
  })();

  return inflightSync;
}

export function getOfflineSyncState(): OfflineSyncState {
  return buildSyncState(loadSnapshotFromStorage());
}

export function clearSnapshotCache(): void {
  inMemorySnapshot = null;
  initFromStoragePromise = null;
  parishSearchFuse = null;
  if (canUseStorage()) localStorage.removeItem(STORAGE_KEY);
}

function requireSnapshot() {
  const snapshot = loadSnapshotFromStorage();
  if (!snapshot) throw new Error('Offline snapshot not available');
  return snapshot;
}

function getParishSearchFuse() {
  const snapshot = requireSnapshot();
  if (!parishSearchFuse) {
    const diocesesById = new Map(snapshot.dioceses.map((diocese) => [diocese.id, diocese]));
    const documents: ParishSearchDocument[] = snapshot.parishes.map((parish) => {
      const diocese = parish.diocese_id != null ? diocesesById.get(parish.diocese_id) : null;
      return {
        ...parish,
        _dioceseNameZh: diocese?.name_zh ?? null,
        _dioceseNameEn: diocese?.name_en ?? null,
      };
    });
    parishSearchFuse = new Fuse(documents, {
      includeScore: true,
      threshold: 0.38,
      ignoreLocation: true,
      minMatchCharLength: 1,
      keys: [
        { name: 'name_zh', weight: 0.5 },
        { name: 'name_local', weight: 0.4 },
        { name: '_dioceseNameZh', weight: 0.4 },
        { name: 'name_en', weight: 0.3 },
        { name: '_dioceseNameEn', weight: 0.2 },
        { name: 'address', weight: 0.2 },
      ],
    });
  }
  return parishSearchFuse;
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function buildHumanReadableRRule(rruleString?: string | null) {
  if (!rruleString) return null;

  try {
    const options = RRule.parseString(rruleString);
    const weekdaysMap: Record<string, string> = {
      MO: '週一',
      TU: '週二',
      WE: '週三',
      TH: '週四',
      FR: '週五',
      SA: '週六',
      SU: '週日',
    };
    const byDay = Array.isArray(options.byweekday)
      ? options.byweekday.map((weekday) => weekdaysMap[String(weekday)] ?? String(weekday))
      : options.byweekday != null
        ? [weekdaysMap[String(options.byweekday)] ?? String(options.byweekday)]
        : [];
    const hour = Array.isArray(options.byhour) ? options.byhour[0] : options.byhour ?? 0;
    const minute = Array.isArray(options.byminute) ? options.byminute[0] : options.byminute ?? 0;
    const dayLabel = byDay.length > 0 ? byDay.join('、') : '每週';
    return `${dayLabel} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  } catch (error) {
    console.warn('Failed to build RRULE label:', error);
    return null;
  }
}

function getNextOccurrence(rruleString?: string | null, now = new Date()) {
  if (!rruleString) return null;

  try {
    const options = RRule.parseString(rruleString);
    const dtstart = datetime(now.getFullYear(), 1, 1, 0, 0, 0);
    const floatingNow = datetime(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );
    const rule = new RRule({ ...options, dtstart });
    const nextOccurrence = rule.after(floatingNow, true);
    if (!nextOccurrence) return null;

    return new Date(
      nextOccurrence.getUTCFullYear(),
      nextOccurrence.getUTCMonth(),
      nextOccurrence.getUTCDate(),
      nextOccurrence.getUTCHours(),
      nextOccurrence.getUTCMinutes(),
      nextOccurrence.getUTCSeconds(),
    );
  } catch (error) {
    console.warn('Failed to resolve next occurrence:', error);
    return null;
  }
}

function normalizeSummary(parish: OfflineParish, diocese?: OfflineDiocese | null, distanceKm?: number | null): ParishSummary {
  const displayName = parish.name_zh || parish.name_local || parish.name_en || '';
  return {
    id: parish.id,
    name_zh: displayName,
    name_local: parish.name_local ?? null,
    name_en: parish.name_en ?? null,
    address: parish.address ?? null,
    latitude: parish.lat,
    longitude: parish.lng,
    phone: parish.phone ?? null,
    website: parish.website ?? null,
    distance_km: distanceKm != null ? Number(distanceKm.toFixed(2)) : null,
    diocese: diocese
      ? {
          id: diocese.id,
          name_zh: diocese.name_zh,
          name_en: diocese.name_en ?? null,
        }
      : null,
  };
}

function normalizeMassTime(
  massTime: OfflineMassTime,
  languagesById: Map<number, OfflineLanguage>,
  massTypesById: Map<number, OfflineMassType>,
): MassTime {
  const language = massTime.language ? languagesById.get(Number(massTime.language)) : null;
  const massType = massTime.mass_type_id != null ? massTypesById.get(Number(massTime.mass_type_id)) : null;
  const label = massTime.label ?? null;

  return {
    id: massTime.id,
    rrule: massTime.rrule ?? null,
    human_readable: buildHumanReadableRRule(massTime.rrule),
    dtstart: getNextOccurrence(massTime.rrule)?.toISOString() ?? null,
    duration_minutes: massTime.duration_minutes ?? null,
    language: language?.name_zh ?? (massTime.language ? (LANGUAGE_NAMES[massTime.language] ?? massTime.language) : null),
    label,
    location_note: massTime.location_note ?? null,
    remarks: massTime.remarks ?? null,
    mass_type: massType
      ? {
          type_code: massType.type_code ?? null,
          name_zh: massType.name_zh ?? null,
        }
      : null,
  };
}

export function hasOfflineSnapshot() {
  return Boolean(loadSnapshotFromStorage());
}

export function getOfflineSnapshot() {
  return loadSnapshotFromStorage();
}

export function getParishSummaryById(id: number): ParishSummary | null {
  const snapshot = loadSnapshotFromStorage();
  if (!snapshot) return null;
  const parish = snapshot.parishes.find((p) => p.id === id);
  if (!parish) return null;
  const diocesesById = new Map(snapshot.dioceses.map((d) => [d.id, d]));
  return normalizeSummary(parish, diocesesById.get(parish.diocese_id ?? -1) ?? null);
}

export function getAllParishesAsGeoJSON(): GeoJSON.FeatureCollection {
  const snapshot = loadSnapshotFromStorage();
  if (!snapshot) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: snapshot.parishes
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng!, p.lat!] },
        properties: {
          id: p.id,
          name_zh: p.name_zh ?? p.name_local ?? p.name_en ?? '',
          diocese_id: p.diocese_id ?? null,
        },
      })),
  };
}

export function searchParishesOffline(query: string, page = 1, perPage = 20): ParishSummary[] {
  const snapshot = requireSnapshot();
  const diocesesById = new Map(snapshot.dioceses.map((item) => [item.id, item]));
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = !normalizedQuery
    ? snapshot.parishes
    : getParishSearchFuse()
        .search(normalizedQuery)
        .map((result) => result.item);

  return filtered
    .slice((page - 1) * perPage, page * perPage)
    .map((parish) => normalizeSummary(parish, diocesesById.get(parish.diocese_id ?? -1) ?? null));
}

export function getParishSuggestionsOffline(
  query: string,
  limit = 6,
  location?: { lat: number; lng: number } | null,
): ParishSummary[] {
  const snapshot = requireSnapshot();
  const diocesesById = new Map(snapshot.dioceses.map((item) => [item.id, item]));
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return getParishSearchFuse()
    .search(normalizedQuery, { limit: limit * 2 })
    .map((result) => {
      const distanceKm = location
        ? haversineDistanceKm(location.lat, location.lng, result.item.lat, result.item.lng)
        : null;
      return {
        parish: result.item,
        score: result.score ?? 1,
        distanceKm,
      };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER);
    })
    .slice(0, limit)
    .map((item) =>
      normalizeSummary(
        item.parish,
        diocesesById.get(item.parish.diocese_id ?? -1) ?? null,
        item.distanceKm ?? undefined,
      ),
    );
}

export function getNearbyParishesOffline(lat: number, lng: number, radius = 10, limit = 20): ParishSummary[] {
  const snapshot = requireSnapshot();
  const diocesesById = new Map(snapshot.dioceses.map((item) => [item.id, item]));

  return snapshot.parishes
    .map((parish) => {
      const distanceKm = haversineDistanceKm(lat, lng, parish.lat, parish.lng);
      return {
        parish,
        distanceKm,
      };
    })
    .filter((item) => item.distanceKm <= radius)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((item) => normalizeSummary(item.parish, diocesesById.get(item.parish.diocese_id ?? -1) ?? null, item.distanceKm));
}

export function getParishesInBoundsOffline(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 100,
): ParishSummary[] {
  const snapshot = requireSnapshot();
  const diocesesById = new Map(snapshot.dioceses.map((item) => [item.id, item]));
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;
  const crossesAntimeridian = west > east;

  return snapshot.parishes
    .filter((parish) => {
      const withinLat = parish.lat >= south && parish.lat <= north;
      const withinLng = crossesAntimeridian
        ? parish.lng >= west || parish.lng <= east
        : parish.lng >= west && parish.lng <= east;
      return withinLat && withinLng;
    })
    .map((parish) => ({
      parish,
      distanceKm: haversineDistanceKm(centerLat, centerLng, parish.lat, parish.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((item) =>
      normalizeSummary(item.parish, diocesesById.get(item.parish.diocese_id ?? -1) ?? null, item.distanceKm),
    );
}

export function getParishDetailOffline(id: string | number): ParishDetail | null {
  const snapshot = requireSnapshot();
  const parish = snapshot.parishes.find((item) => String(item.id) === String(id));
  if (!parish) return null;

  const diocesesById = new Map(snapshot.dioceses.map((item) => [item.id, item]));
  const languagesById = new Map(snapshot.languages.map((item) => [item.id, item]));
  const massTypesById = new Map(snapshot.massTypes.map((item) => [item.id, item]));

  const photos = snapshot.photos
    .filter((item) => item.parish_id === parish.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((item) => ({ image_url: item.image_url, description: item.description ?? null }));

  const massTimes = snapshot.massTimes
    .filter((item) => item.parish_id === parish.id)
    .map((item) => normalizeMassTime(item, languagesById, massTypesById));

  const priests = snapshot.priests
    .filter((item) => Array.isArray(item.parish_ids) && item.parish_ids.includes(parish.id))
    .map<Priest>((item) => ({
      id: item.id,
      name_zh: item.name_zh ?? null,
      name_en: item.name_en ?? null,
      title: item.title ?? null,
      role: item.title ?? null,
      is_active: true,
    }));

  return {
    ...normalizeSummary(parish, diocesesById.get(parish.diocese_id ?? -1) ?? null),
    email: parish.email ?? null,
    fb_url: parish.fb_url ?? null,
    ig_url: parish.ig_url ?? null,
    priest_name: parish.priest_name ?? null,
    has_sub_venues: Boolean(parish.has_sub_venues),
    deanery: null,
    city: null,
    mass_times: massTimes,
    photos,
    priests,
  };
}

export function getUpcomingMassesOffline(
  lat: number,
  lng: number,
  radius = 10,
  withinHours = 168,
  limit = 20,
): UpcomingMass[] {
  const snapshot = requireSnapshot();
  const now = new Date();
  const maxMinutesAway = withinHours * 60;
  const diocesesById = new Map(snapshot.dioceses.map((item) => [item.id, item]));
  const languagesById = new Map(snapshot.languages.map((item) => [item.id, item]));
  const massTypesById = new Map(snapshot.massTypes.map((item) => [item.id, item]));
  const parishesById = new Map(snapshot.parishes.map((item) => [item.id, item]));

  return snapshot.massTimes
    .map((massTime) => {
      const parish = parishesById.get(massTime.parish_id);
      if (!parish) return null;
      const distanceKm = haversineDistanceKm(lat, lng, parish.lat, parish.lng);
      if (distanceKm > radius) return null;
      const nextOccurrence = getNextOccurrence(massTime.rrule, now);
      if (!nextOccurrence) return null;
      const minutesAway = Math.round((nextOccurrence.getTime() - now.getTime()) / 60000);
      if (minutesAway < 0 || minutesAway > maxMinutesAway) return null;

      return {
        parish: normalizeSummary(parish, diocesesById.get(parish.diocese_id ?? -1) ?? null, distanceKm),
        mass_time: normalizeMassTime(massTime, languagesById, massTypesById),
        next_at: nextOccurrence.toISOString(),
        minutes_away: minutesAway,
        distance_km: Number(distanceKm.toFixed(2)),
      } satisfies UpcomingMass;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      const minutesDelta = (a.minutes_away ?? 0) - (b.minutes_away ?? 0);
      if (minutesDelta !== 0) return minutesDelta;
      return (a.distance_km ?? 0) - (b.distance_km ?? 0);
    })
    .slice(0, limit);
}
