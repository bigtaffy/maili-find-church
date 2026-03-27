import {
  getParishesInBoundsOffline,
  ensureOfflineDataFresh,
  getParishSuggestionsOffline,
  getNearbyParishesOffline,
  getParishDetailOffline,
  getUpcomingMassesOffline,
  hasOfflineSnapshot,
  searchParishesOffline,
} from './offlineData';
import type {
  CollectionResponse,
  OfflineSyncState,
  ParishDetail,
  ParishSummary,
  SingleResponse,
  UpcomingMass,
} from './types';

export type {
  CollectionResponse,
  OfflineSyncState,
  ParishDetail,
  ParishPhoto,
  ParishSummary,
  Priest,
  MassTime,
  SingleResponse,
  UpcomingMass,
} from './types';

export const BASE_URL = 'https://maili-news-scrapper.chihhe.dev/api/v1';

const MOCK_CHURCHES: ParishDetail[] = [
  {
    id: 1,
    name_zh: '聖母無原罪主教座堂',
    name_en: 'Cathedral of the Immaculate Conception',
    address: '台北市大同區民生西路245號',
    latitude: 25.0564,
    longitude: 121.5175,
    distance_km: 1.2,
    phone: '02-2557-4874',
    website: null,
    diocese: { id: 7, name_zh: '台北教區', name_en: 'Diocese of Taipei' },
    priests: [{ id: 1, name_zh: '鍾安住 主教', title: '主教' }, { id: 2, name_zh: '黃兆明 神父', title: '神父' }],
    photos: [{ image_url: 'https://images.unsplash.com/photo-1548625361-ec846e2e92c2?auto=format&fit=crop&q=80&w=1200', description: '教堂外觀' }],
    mass_times: [],
  },
  {
    id: 2,
    name_zh: '聖家堂',
    name_en: 'Holy Family Parish',
    address: '台北市大安區新生南路二段50號',
    latitude: 25.0273,
    longitude: 121.5361,
    distance_km: 2.5,
    phone: '02-2321-2444',
    website: null,
    diocese: { id: 7, name_zh: '台北教區', name_en: 'Diocese of Taipei' },
    priests: [{ id: 3, name_zh: '饒志成 神父', title: '神父' }],
    photos: [{ image_url: 'https://images.unsplash.com/photo-1519817650390-64a93db511aa?auto=format&fit=crop&q=80&w=1200', description: '教堂外觀' }],
    mass_times: [],
  },
];

async function syncOfflineData(force = false): Promise<OfflineSyncState> {
  return ensureOfflineDataFresh(force);
}

async function tryFetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

function buildMockUpcomingMasses(): UpcomingMass[] {
  return MOCK_CHURCHES.map((church, index) => ({
    parish: {
      id: church.id,
      name_zh: church.name_zh,
      name_en: church.name_en,
      address: church.address,
      latitude: church.latitude,
      longitude: church.longitude,
      phone: church.phone,
      website: church.website,
      diocese: church.diocese,
      distance_km: church.distance_km,
    },
    mass_time: church.mass_times[0] ?? null,
    next_at: null,
    minutes_away: 45 + index * 30,
    distance_km: church.distance_km ?? null,
  }));
}

export const api = {
  syncOfflineData,

  async getNearbyParishes(lat: number, lng: number, radius = 10, limit = 20): Promise<CollectionResponse<ParishSummary>> {
    await syncOfflineData();
    if (hasOfflineSnapshot()) {
      return { data: getNearbyParishesOffline(lat, lng, radius, limit) };
    }

    try {
      const json = await tryFetchJson<CollectionResponse<ParishSummary>>(
        `${BASE_URL}/parishes/nearby?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`,
      );
      return json;
    } catch (error) {
      console.warn('API failed, using mock data for nearby parishes:', error);
      return {
        data: MOCK_CHURCHES.map((church) => ({
          id: church.id,
          name_zh: church.name_zh,
          name_en: church.name_en,
          address: church.address,
          latitude: church.latitude,
          longitude: church.longitude,
          phone: church.phone,
          website: church.website,
          diocese: church.diocese,
          distance_km: church.distance_km,
        })),
      };
    }
  },

  async getParishesInBounds(
    west: number,
    south: number,
    east: number,
    north: number,
    limit = 1000,
  ): Promise<CollectionResponse<ParishSummary>> {
    await syncOfflineData();
    if (hasOfflineSnapshot()) {
      return { data: getParishesInBoundsOffline(west, south, east, north, limit) };
    }

    const centerLat = (south + north) / 2;
    const centerLng = (west + east) / 2;
    const latSpanKm = Math.abs(north - south) * 111;
    const lngSpanKm = Math.abs(east - west) * 111 * Math.cos((centerLat * Math.PI) / 180);
    const radius = Math.max(latSpanKm, lngSpanKm) / 2;
    return this.getNearbyParishes(centerLat, centerLng, Math.max(radius, 1), limit);
  },

  async getUpcomingMasses(
    lat: number,
    lng: number,
    radius = 10,
    withinHours = 168,
    limit = 20,
  ): Promise<CollectionResponse<UpcomingMass>> {
    await syncOfflineData();
    if (hasOfflineSnapshot()) {
      return { data: getUpcomingMassesOffline(lat, lng, radius, withinHours, limit) };
    }

    try {
      return await tryFetchJson<CollectionResponse<UpcomingMass>>(
        `${BASE_URL}/mass-times/upcoming?lat=${lat}&lng=${lng}&radius=${radius}&within_hours=${withinHours}&limit=${limit}`,
      );
    } catch (error) {
      console.warn('API failed, using mock data for upcoming masses:', error);
      return { data: buildMockUpcomingMasses() };
    }
  },

  async getParishDetail(id: string | number): Promise<SingleResponse<ParishDetail>> {
    await syncOfflineData();

    try {
      const json = await tryFetchJson<SingleResponse<ParishDetail>>(`${BASE_URL}/parishes/${id}`);
      return json;
    } catch (error) {
      console.warn('Remote parish detail failed, trying offline snapshot:', error);
      if (hasOfflineSnapshot()) {
        const local = getParishDetailOffline(id);
        if (local) return { data: local };
      }

      const church = MOCK_CHURCHES.find((item) => item.id.toString() === id.toString()) ?? MOCK_CHURCHES[0];
      return { data: church };
    }
  },

  async searchParishes(query: string, page = 1, perPage = 20): Promise<CollectionResponse<ParishSummary>> {
    await syncOfflineData();
    if (hasOfflineSnapshot()) {
      return { data: searchParishesOffline(query, page, perPage) };
    }

    try {
      return await tryFetchJson<CollectionResponse<ParishSummary>>(
        `${BASE_URL}/parishes?q=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`,
      );
    } catch (error) {
      console.warn('API failed, using mock data for search:', error);
      const filtered = MOCK_CHURCHES.filter(
        (church) =>
          church.name_zh.includes(query) ||
          church.name_en?.toLowerCase().includes(query.toLowerCase()) ||
          church.address?.includes(query),
      );
      return {
        data: filtered.map((church) => ({
          id: church.id,
          name_zh: church.name_zh,
          name_en: church.name_en,
          address: church.address,
          latitude: church.latitude,
          longitude: church.longitude,
          phone: church.phone,
          website: church.website,
          diocese: church.diocese,
          distance_km: church.distance_km,
        })),
      };
    }
  },

  async getParishSuggestions(
    query: string,
    limit = 6,
    location?: { lat: number; lng: number } | null,
  ): Promise<CollectionResponse<ParishSummary>> {
    await syncOfflineData();
    if (hasOfflineSnapshot()) {
      return { data: getParishSuggestionsOffline(query, limit, location) };
    }

    const fallback = await this.searchParishes(query, 1, limit);
    return { data: fallback.data.slice(0, limit) };
  },
};
