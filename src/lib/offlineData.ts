import Fuse from 'fuse.js';
import { RRule } from 'rrule';
import type { MassTime, OfflineSyncState, ParishDetail, ParishPhoto, ParishSummary, Priest, UpcomingMass } from './types';

const SYNC_VERSION_URL = 'https://maili-news-scrapper.chihhe.dev/api/v1/sync/version';
const SYNC_DOWNLOAD_URL = 'https://maili-news-scrapper.chihhe.dev/api/v1/sync/download';
const STORAGE_KEY = 'maili-offline-snapshot-v1';

type OfflineParish = {
  id: number;
  name_zh: string;
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

let inMemorySnapshot: OfflineSnapshot | null = null;
let inflightSync: Promise<OfflineSyncState> | null = null;
let parishSearchFuse: Fuse<OfflineParish> | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

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

function loadSnapshotFromStorage(): OfflineSnapshot | null {
  if (inMemorySnapshot) return inMemorySnapshot;
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as OfflineSnapshot;
    inMemorySnapshot = parsed;
    return parsed;
  } catch (error) {
    console.warn('Failed to parse offline snapshot:', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveSnapshot(payload: OfflineSnapshotPayload) {
  if (!canUseStorage()) return;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  inMemorySnapshot = snapshot;
  parishSearchFuse = null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}

export async function ensureOfflineDataFresh(force = false): Promise<OfflineSyncState> {
  if (inflightSync && !force) return inflightSync;

  inflightSync = (async () => {
    const snapshot = loadSnapshotFromStorage();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return buildSyncState(snapshot, { isStale: true });
    }

    try {
      const versionInfo = await fetchJson<{ version: number; updated_at: string }>(SYNC_VERSION_URL);
      if (!snapshot || force || versionInfo.version > snapshot.version) {
        const payload = await fetchJson<OfflineSnapshotPayload>(SYNC_DOWNLOAD_URL);
        saveSnapshot(payload);
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

function requireSnapshot() {
  const snapshot = loadSnapshotFromStorage();
  if (!snapshot) throw new Error('Offline snapshot not available');
  return snapshot;
}

function getParishSearchFuse() {
  const snapshot = requireSnapshot();
  if (!parishSearchFuse) {
    parishSearchFuse = new Fuse(snapshot.parishes, {
      includeScore: true,
      threshold: 0.38,
      ignoreLocation: true,
      minMatchCharLength: 1,
      keys: [
        { name: 'name_zh', weight: 0.5 },
        { name: 'name_en', weight: 0.3 },
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
    const dtstart = new Date(now);
    dtstart.setMonth(0, 1);
    dtstart.setHours(0, 0, 0, 0);
    const rule = new RRule({ ...options, dtstart });
    return rule.after(now, true);
  } catch (error) {
    console.warn('Failed to resolve next occurrence:', error);
    return null;
  }
}

function normalizeSummary(parish: OfflineParish, diocese?: OfflineDiocese | null, distanceKm?: number | null): ParishSummary {
  return {
    id: parish.id,
    name_zh: parish.name_zh,
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
  const label = massTime.label ?? language?.name_zh ?? null;

  return {
    id: massTime.id,
    rrule: massTime.rrule ?? null,
    human_readable: buildHumanReadableRRule(massTime.rrule),
    dtstart: getNextOccurrence(massTime.rrule)?.toISOString() ?? null,
    duration_minutes: massTime.duration_minutes ?? null,
    language: language?.name_zh ?? massTime.language ?? null,
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
