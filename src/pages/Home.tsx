import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Navigation, Loader2, X, Clock3, CloudOff, Database, RefreshCw, MapPin, Phone, Globe, Church } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import Map, { Marker, type MapRef, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppView } from '@/components/Layout';
import { api, type OfflineSyncState, type ParishDetail, type ParishSummary, type UpcomingMass } from '@/lib/api';
import { getMassDisplayTitle, sortMassTimes } from '@/lib/utils';

const FALLBACK_LOCATION = { lat: 25.0478, lng: 121.517 };
const FALLBACK_CHURCH_IMAGE =
  'https://images.unsplash.com/photo-1548625361-ec846e2e92c2?auto=format&fit=crop&q=80&w=1200';
const OPEN_FREE_MAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SHEET_HEIGHT = '74vh';
const COLLAPSED_SHEET_VISIBLE_HEIGHT = '148px';
const BOTTOM_NAV_OFFSET = 'calc(4rem + env(safe-area-inset-bottom, 0px))';
const SEARCH_BAR_PADDING_TOP = 132;
const FOCUS_BOTTOM_PADDING = 360;
const FOCUS_SIDE_PADDING = 56;
const SHEET_TRANSLATE = {
  expanded: '0px',
  collapsed: `calc(74vh - ${COLLAPSED_SHEET_VISIBLE_HEIGHT})`,
  hidden: 'calc(100% + 3.5rem + env(safe-area-inset-bottom, 0px))',
} as const;
const LOCATION_BUTTON_BOTTOM = {
  expanded: 'calc(74vh + 4rem + env(safe-area-inset-bottom, 0px))',
  collapsed: `calc(${COLLAPSED_SHEET_VISIBLE_HEIGHT} + 4rem + env(safe-area-inset-bottom, 0px))`,
  hidden: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
} as const;
const SHEET_SPRING = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 34,
  mass: 0.9,
};

function formatDistance(distanceKm?: number | null, address?: string | null) {
  if (distanceKm != null) return `距離 ${distanceKm.toFixed(2)} 公里`;
  return address || '地址待補充';
}

function formatMassCountdown(minutesAway?: number | null) {
  if (minutesAway == null) return null;
  if (minutesAway < 60) return `${minutesAway} 分鐘後`;
  const hours = Math.floor(minutesAway / 60);
  const minutes = minutesAway % 60;
  if (minutes === 0) return `${hours} 小時後`;
  return `${hours} 小時 ${minutes} 分鐘後`;
}

function getChurchImage(detail: ParishDetail | null) {
  return detail?.photos?.[0]?.image_url || FALLBACK_CHURCH_IMAGE;
}

function getFocusBounds(
  location: { lat: number; lng: number },
  church: { latitude: number; longitude: number },
) {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 430;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const aspectRatio = viewportHeight / Math.max(viewportWidth, 1);
  const minFocusLatSpan =
    viewportWidth <= 430 && aspectRatio >= 1.9
      ? 0.0048
      : viewportWidth <= 768
        ? 0.0068
        : 0.0095;
  const centerLat = (location.lat + church.latitude) / 2;
  const latSpan = Math.max(Math.abs(location.lat - church.latitude), minFocusLatSpan);
  const lngFloor = minFocusLatSpan / Math.max(Math.cos((centerLat * Math.PI) / 180), 0.45);
  const lngSpan = Math.max(Math.abs(location.lng - church.longitude), lngFloor);

  return {
    minLat: centerLat - latSpan / 2,
    maxLat: centerLat + latSpan / 2,
    minLng: (location.lng + church.longitude) / 2 - lngSpan / 2,
    maxLng: (location.lng + church.longitude) / 2 + lngSpan / 2,
  };
}

function getFocusPadding() {
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 430;
  const bottom = Math.min(FOCUS_BOTTOM_PADDING, Math.round(viewportHeight * 0.28));
  const side = Math.max(28, Math.min(FOCUS_SIDE_PADDING, Math.round(viewportWidth * 0.1)));

  return {
    top: SEARCH_BAR_PADDING_TOP,
    right: side,
    bottom,
    left: side,
  };
}

function getDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getHomeFocusZoomByDistance(distanceKm: number) {
  if (distanceKm <= 0.2) return 15.6;
  if (distanceKm <= 0.4) return 15.2;
  if (distanceKm <= 0.8) return 14.8;
  if (distanceKm <= 1.2) return 14.5;
  if (distanceKm <= 2) return 14.1;
  if (distanceKm <= 3.5) return 13.7;
  return 13.3;
}

function getFocusCenter(
  location: { lat: number; lng: number },
  church: { latitude: number; longitude: number },
) {
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 430;
  const aspectRatio = viewportHeight / Math.max(viewportWidth, 1);
  const centerLat = (location.lat + church.latitude) / 2;
  const centerLng = (location.lng + church.longitude) / 2;
  const latOffset =
    viewportWidth <= 430 && aspectRatio >= 1.9
      ? 0.0016
      : viewportWidth <= 768
        ? 0.0011
        : 0.0008;

  return {
    latitude: centerLat + latOffset,
    longitude: centerLng,
  };
}

function SyncBadge({ syncState, onRefresh }: { syncState: OfflineSyncState | null; onRefresh: () => void }) {
  if (!syncState) return null;

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const label = syncState.ready
    ? syncState.source === 'remote'
      ? '資料已同步'
      : syncState.isStale
        ? '使用離線資料'
        : '本地資料可用'
    : '尚未下載離線資料';

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {isOffline ? <CloudOff className="w-4 h-4 text-amber-600" /> : <Database className="w-4 h-4 text-emerald-600" />}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800">{label}</p>
          <p className="text-[11px] text-gray-500 truncate">
            {syncState.version ? `版本 ${syncState.version}` : '首次開啟後會快取完整教堂資料包'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-600 active:bg-slate-200"
        aria-label="重新同步"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Home() {
  const { currentView } = useAppView();
  const navigate = useNavigate();

  const [nearbyChurches, setNearbyChurches] = useState<ParishSummary[]>([]);
  const [listItems, setListItems] = useState<UpcomingMass[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<ParishSummary | null>(null);
  const [selectedChurchDetail, setSelectedChurchDetail] = useState<ParishDetail | null>(null);
  const [selectedChurchUpcomingMass, setSelectedChurchUpcomingMass] = useState<UpcomingMass | null>(null);
  const [nearestChurchId, setNearestChurchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<ParishSummary[]>([]);
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(FALLBACK_LOCATION);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [syncState, setSyncState] = useState<OfflineSyncState | null>(null);
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [sheetMode, setSheetMode] = useState<'hidden' | 'collapsed' | 'expanded'>('collapsed');
  const [viewState, setViewState] = useState({
    latitude: FALLBACK_LOCATION.lat,
    longitude: FALLBACK_LOCATION.lng,
    zoom: 10.5,
  });
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 430,
  );
  const mapRef = useRef<MapRef | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusNearestRef = useRef(true);
  const hasUserExploredMapRef = useRef(false);
  const skipNextLocationEffectRef = useRef(false);
  const isNarrowViewport = viewportWidth <= 360;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function requestDeviceGpsLocation() {
    if (!navigator.geolocation) {
      setLocationError('此裝置不支援 GPS 定位');
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    setIsSearchMode(false);
    setSearchSuggestions([]);
    setIsSearchInputFocused(false);
    searchInputRef.current?.blur();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocationError(null);
        hasUserExploredMapRef.current = false;
        skipNextLocationEffectRef.current = true;
        setUserLocation(nextLocation);
        setIsLocating(false);

        try {
          await loadHomeData(nextLocation, { focusNearest: true, background: true });
        } catch (error) {
          console.error('Failed to reload home data after GPS locate:', error);
        }
      },
      (error) => {
        console.warn('Device GPS error:', error);
        setLocationError('無法取得裝置 GPS 定位，請確認已開啟定位權限');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  function focusChurchOnMap(church: ParishSummary) {
    if (mapRef.current) {
      mapRef.current.easeTo({
        center: [church.longitude, church.latitude],
        duration: 700,
      });
    } else {
      setViewState((current) => ({
        ...current,
        latitude: church.latitude,
        longitude: church.longitude,
      }));
    }
  }

  async function runSync(force = false) {
    const state = await api.syncOfflineData(force);
    setSyncState(state);
    return state;
  }

  useEffect(() => {
    if (!syncState) return;

    const shouldPersist = syncState.isStale || syncState.source === 'none' || Boolean(syncState.error);
    if (shouldPersist) {
      setShowSyncToast(true);
      return;
    }

    setShowSyncToast(true);
    const timeoutId = window.setTimeout(() => {
      setShowSyncToast(false);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [syncState?.version, syncState?.source, syncState?.isStale, syncState?.error]);

  async function loadHomeData(
    location: { lat: number; lng: number },
    options: { preserveSelection?: boolean; focusNearest?: boolean; background?: boolean } = {},
  ) {
    const { preserveSelection = false, focusNearest = false, background = false } = options;
    if (!background) {
      setLoading(true);
    }
    try {
      const state = await runSync(false);
      setSyncState(state);
      const [nearbyRes, upcomingRes] = await Promise.all([
        api.getNearbyParishes(location.lat, location.lng, 10, 20),
        api.getUpcomingMasses(location.lat, location.lng, 10, 168, 20),
      ]);
      const nearestChurch = nearbyRes.data?.[0] ?? null;
      setNearestChurchId(nearestChurch?.id ?? null);
      setNearbyChurches(focusNearest && nearestChurch ? [nearestChurch] : nearbyRes.data || []);
      setListItems(upcomingRes.data || []);
      setSelectedChurch((current) => {
        if (focusNearest) return nearestChurch;
        if (preserveSelection && current && nearbyRes.data?.some((church) => church.id === current.id)) {
          return current;
        }
        return nearbyRes.data?.[0] ?? null;
      });
      if (focusNearest && nearestChurch) {
        const padding = getFocusPadding();
        const distanceKm = getDistanceKm(location, {
          lat: nearestChurch.latitude,
          lng: nearestChurch.longitude,
        });
        const focusZoom = getHomeFocusZoomByDistance(distanceKm);
        const focusCenter = getFocusCenter(location, nearestChurch);

        if (mapRef.current) {
          setViewState((current) => ({
            ...current,
            latitude: focusCenter.latitude,
            longitude: focusCenter.longitude,
            zoom: focusZoom,
            padding,
          }));

          mapRef.current.easeTo({
            center: [focusCenter.longitude, focusCenter.latitude],
            zoom: focusZoom,
            padding,
            duration: 900,
          });
        } else {
          setViewState((current) => ({
            ...current,
            latitude: focusCenter.latitude,
            longitude: focusCenter.longitude,
            zoom: focusZoom,
            padding,
          }));
        }
        setSheetMode('collapsed');
      }
      setIsSearchMode(false);
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('此裝置不支援定位，先顯示預設區域');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationError(null);
        shouldFocusNearestRef.current = true;
        hasUserExploredMapRef.current = false;
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setLocationError('無法取得定位，先顯示預設區域');
        shouldFocusNearestRef.current = true;
        hasUserExploredMapRef.current = false;
        setUserLocation(FALLBACK_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    if (!userLocation) return;
    if (skipNextLocationEffectRef.current) {
      skipNextLocationEffectRef.current = false;
      return;
    }
    const focusNearest = shouldFocusNearestRef.current;
    shouldFocusNearestRef.current = false;
    loadHomeData(userLocation, { focusNearest });
  }, [userLocation]);

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (!keyword) {
      setSearchSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await api.getParishSuggestions(keyword, 6, userLocation);
        setSearchSuggestions(res.data || []);
      } catch (error) {
        console.error('Failed to load search suggestions:', error);
        setSearchSuggestions([]);
      }
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery, userLocation]);

  useEffect(() => {
    async function hydrateSelectedChurch() {
      if (!selectedChurch) {
        setSelectedChurchDetail(null);
        setSelectedChurchUpcomingMass(null);
        return;
      }

      setSheetMode('collapsed');

      try {
        const [detailRes, upcomingRes] = await Promise.all([
          api.getParishDetail(selectedChurch.id),
          api.getUpcomingMasses(selectedChurch.latitude, selectedChurch.longitude, 0.2, 168, 8),
        ]);

        setSelectedChurchDetail(detailRes.data);
        setSelectedChurchUpcomingMass(
          upcomingRes.data.find((item) => item.parish.id === selectedChurch.id) ?? null,
        );
      } catch (error) {
        console.error('Failed to hydrate selected church:', error);
        setSelectedChurchDetail(null);
        setSelectedChurchUpcomingMass(null);
      }
    }

    hydrateSelectedChurch();
  }, [selectedChurch]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const keyword = searchQuery.trim();

    if (!keyword) {
      setSearchSuggestions([]);
      if (userLocation) await loadHomeData(userLocation);
      return;
    }

    setLoading(true);
    try {
      await runSync(false);
      const res = await api.searchParishes(keyword, 1, 20);
      setSearchSuggestions([]);
      setNearbyChurches(res.data || []);
      setSelectedChurch(res.data?.[0] ?? null);
      setListItems(
        (res.data || []).map((parish) => ({
          parish,
          mass_time: null,
          next_at: null,
          minutes_away: null,
          distance_km: parish.distance_km ?? null,
        })),
      );
      setIsSearchMode(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  async function clearSearch() {
    setSearchQuery('');
    setSearchSuggestions([]);
    if (userLocation) await loadHomeData(userLocation);
  }

  function applySuggestion(parish: ParishSummary) {
    setSearchQuery(parish.name_zh);
    setSearchSuggestions([]);
    setIsSearchInputFocused(false);
    searchInputRef.current?.blur();
    setNearbyChurches([parish]);
    setSelectedChurch(parish);
    focusChurchOnMap(parish);
    setSheetMode('collapsed');
    setListItems([
      {
        parish,
        mass_time: null,
        next_at: null,
        minutes_away: null,
        distance_km: parish.distance_km ?? null,
      },
    ]);
    setIsSearchMode(true);
  }

  async function refreshOfflinePackage() {
    setLoading(true);
    try {
      await runSync(true);
      if (userLocation) await loadHomeData(userLocation);
    } finally {
      setLoading(false);
    }
  }

  async function refreshChurchesInViewport() {
    if (!mapRef.current || isSearchMode || !hasUserExploredMapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    try {
      const res = await api.getParishesInBounds(
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
        1000,
      );
      setNearbyChurches(res.data || []);
      setSelectedChurch((current) => {
        if (current && res.data.some((church) => church.id === current.id)) {
          return current;
        }
        return res.data[0] ?? null;
      });
    } catch (error) {
      console.error('Failed to refresh churches in viewport:', error);
    }
  }

  const selectedChurchMassTimes = selectedChurchDetail?.mass_times ?? [];
  const selectedChurchSundayMasses = sortMassTimes(
    selectedChurchMassTimes.filter((item) => item.mass_type?.type_code === 'sunday'),
  ).slice(0, 4);
  const selectedChurchWeekdayMasses = sortMassTimes(
    selectedChurchMassTimes.filter((item) => item.mass_type?.type_code === 'weekday'),
  ).slice(0, 4);

  function handleSheetDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) {
    if (info.offset.y > 120 || info.velocity.y > 700) {
      setSheetMode('hidden');
      return;
    }

    if (info.offset.y > 40) {
      setSheetMode('collapsed');
      return;
    }

    if (info.offset.y < -80 || info.velocity.y < -700) {
      setSheetMode('expanded');
      return;
    }

    setSheetMode((current) => current);
  }

  function handleUserMapExplore() {
    if (isSearchMode) return;
    hasUserExploredMapRef.current = true;
  }

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-0 left-0 right-0 p-4 z-[1000] space-y-2">
        <form onSubmit={handleSearch} className="bg-white rounded-full shadow-md flex items-center px-4 py-3">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchInputFocused(true)}
            onBlur={() => setIsSearchInputFocused(false)}
            placeholder="搜尋教堂、英文名或地址"
            className="flex-1 bg-transparent outline-none text-gray-700"
            autoComplete="off"
          />
          {searchQuery && (
            <button type="button" onClick={clearSearch} className="text-gray-400 p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {isSearchInputFocused && searchSuggestions.length > 0 && (
          <div className="overflow-hidden rounded-3xl bg-white/95 backdrop-blur shadow-lg">
            {searchSuggestions.map((parish) => (
              <button
                key={parish.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applySuggestion(parish)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="mt-0.5 rounded-full bg-emerald-50 p-2 text-emerald-700">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">{parish.name_zh}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {formatDistance(parish.distance_km, parish.address)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {showSyncToast && <SyncBadge syncState={syncState} onRefresh={refreshOfflinePackage} />}

        {locationError && (
          <div className="bg-amber-50 text-amber-800 text-xs px-4 py-2 rounded-2xl shadow-sm">
            {locationError}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-full w-full flex flex-col items-center justify-center bg-gray-50 pt-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500 text-sm">載入附近教堂...</p>
        </div>
      ) : currentView === 'map' ? (
        <div className="h-full w-full relative">
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            {...viewState}
            onMove={(event: ViewStateChangeEvent) => setViewState(event.viewState)}
            onDragStart={handleUserMapExplore}
            onZoomStart={handleUserMapExplore}
            onMoveEnd={refreshChurchesInViewport}
            minZoom={5.2}
            maxZoom={18}
            reuseMaps
            style={{ width: '100%', height: '100%' }}
            mapStyle={OPEN_FREE_MAP_LIBERTY_STYLE}
          >
            <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-4 ring-blue-200" />
            </Marker>

            {nearbyChurches.map((church) => (
              <Marker key={church.id} longitude={church.longitude} latitude={church.latitude} anchor="bottom">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChurch(church);
                    focusChurchOnMap(church);
                  }}
                  className="group"
                >
                  {selectedChurch?.id === church.id ? (
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                      className="flex items-center gap-2 rounded-full bg-white/96 pr-3 pl-2 py-1.5 text-xs font-semibold text-slate-900 shadow-lg ring-1 ring-blue-100 transition"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-4 ring-blue-200/70">
                        <Church className="h-4.5 w-4.5" strokeWidth={2.2} />
                      </div>
                      <span className="max-w-32 truncate">{church.name_zh}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={{ y: [0, -2, 0] }}
                      transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut', delay: (church.id % 5) * 0.12 }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/18 p-1 shadow-[0_8px_20px_rgba(15,23,42,0.12)] transition group-active:scale-95"
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-full border border-white/80 bg-emerald-600 text-white ring-2 ring-emerald-100/80">
                        <Church className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                    </motion.div>
                  )}
                </button>
              </Marker>
            ))}
          </Map>

          <AnimatePresence>
            {selectedChurch && (
              <>
                <motion.button
                  type="button"
                  initial={{ bottom: LOCATION_BUTTON_BOTTOM.hidden, opacity: 0 }}
                  animate={{ bottom: LOCATION_BUTTON_BOTTOM[sheetMode], opacity: 1 }}
                  exit={{ bottom: LOCATION_BUTTON_BOTTOM.hidden, opacity: 0 }}
                  transition={SHEET_SPRING}
                  onClick={requestDeviceGpsLocation}
                  className={`absolute z-[1100] flex translate-y-1/2 items-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 active:bg-gray-50 ${
                    isNarrowViewport ? 'left-3 gap-1.5 px-3 py-2.5' : 'left-5 gap-2 px-4 py-3'
                  }`}
                >
                  {isLocating ? (
                    <Loader2 className="w-5 h-5 text-gray-700 animate-spin" />
                  ) : (
                    <Navigation className="w-5 h-5 text-gray-700" />
                  )}
                  <span className={`${isNarrowViewport ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>
                    {isLocating ? '定位中' : '定位'}
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  initial={{ bottom: LOCATION_BUTTON_BOTTOM.hidden, opacity: 0 }}
                  animate={{ bottom: LOCATION_BUTTON_BOTTOM[sheetMode], opacity: 1 }}
                  exit={{ bottom: LOCATION_BUTTON_BOTTOM.hidden, opacity: 0 }}
                  transition={SHEET_SPRING}
                  onClick={() => setSheetMode('hidden')}
                  className={`absolute z-[1100] flex translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-500 shadow-lg ring-1 ring-slate-200 backdrop-blur active:bg-slate-50 ${
                    isNarrowViewport ? 'right-3 p-2.5' : 'right-5 p-3'
                  }`}
                  aria-label="關閉教堂資訊"
                >
                  <X className="h-4 w-4" />
                </motion.button>

                <motion.div
                  initial={{ y: SHEET_TRANSLATE.hidden }}
                  animate={{ y: SHEET_TRANSLATE[sheetMode] }}
                  exit={{ y: SHEET_TRANSLATE.hidden }}
                  transition={SHEET_SPRING}
                  drag="y"
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={0.08}
                  dragMomentum={false}
                  onDragEnd={handleSheetDragEnd}
                  className="absolute bottom-0 left-0 right-0 z-[1000] rounded-t-3xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
                  style={{ height: SHEET_HEIGHT, bottom: BOTTOM_NAV_OFFSET }}
                >
                  <div
                    className={`relative h-full ${
                      isNarrowViewport ? 'px-3' : 'px-5'
                    } ${sheetMode === 'expanded' ? 'overflow-y-auto pt-5 pb-6' : 'overflow-hidden pt-4 pb-2'}`}
                  >
                    <div className="relative overflow-hidden rounded-[28px] bg-white">
                    {sheetMode !== 'expanded' && (
                      <>
                        <img
                          src={getChurchImage(selectedChurchDetail)}
                          alt={selectedChurch.name_zh}
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK_CHURCH_IMAGE;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/96 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/86 via-transparent to-white/10" />
                      </>
                    )}

                    <div className={`relative min-w-0 ${sheetMode !== 'expanded' ? (isNarrowViewport ? 'px-1 pt-1.5 pb-1' : 'px-2 pt-2 pb-1') : ''}`}>
                      <div className={`mb-1 ${isNarrowViewport ? 'space-y-1.5' : 'flex items-center gap-2'}`}>
                        <h2 className={`font-bold text-gray-900 line-clamp-2 leading-tight ${
                          sheetMode === 'expanded'
                            ? isNarrowViewport
                              ? 'text-xl'
                              : 'text-2xl'
                            : isNarrowViewport
                              ? 'text-lg'
                              : 'text-xl'
                        }`}>
                          {selectedChurch.name_zh}
                        </h2>
                        {!isSearchMode && selectedChurch.id === nearestChurchId && (
                          <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                            最近
                          </span>
                        )}
                      </div>
                      <p className={`${isNarrowViewport ? 'text-xs' : 'text-sm'} text-gray-500 mb-1.5`}>
                        {formatDistance(selectedChurch.distance_km, selectedChurch.address)}
                      </p>

                      <div className={`rounded-2xl ${isNarrowViewport ? 'px-2.5 py-2' : 'px-3 py-2.5'} mb-1.5 min-w-0 ${sheetMode === 'expanded' ? 'bg-slate-50' : 'bg-white/78 backdrop-blur-sm shadow-sm'}`}>
                        <div className="flex items-center gap-2 text-slate-700 mb-1">
                          <Clock3 className="w-4 h-4" />
                          <span className="text-xs font-semibold">最近彌撒</span>
                        </div>
                        {selectedChurchUpcomingMass?.mass_time ? (
                          <div>
                            <p className={`${isNarrowViewport ? 'text-[13px]' : 'text-sm'} font-medium text-slate-900 line-clamp-2 leading-snug`}>
                              {getMassDisplayTitle(selectedChurchUpcomingMass.mass_time)}
                            </p>
                            <p className={`${isNarrowViewport ? 'text-[11px]' : 'text-xs'} text-slate-600 line-clamp-2 leading-snug`}>
                              {formatMassCountdown(selectedChurchUpcomingMass.minutes_away) || '近期開放中'}
                              {selectedChurchUpcomingMass.mass_time.label
                                ? ` ・ ${selectedChurchUpcomingMass.mass_time.label}`
                                : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">尚未找到近期彌撒，進入詳情可查看固定彌撒時間</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/church/${selectedChurch.id}`)}
                          className={`bg-blue-600 text-white rounded-full font-medium flex items-center gap-2 active:bg-blue-700 transition-colors ${
                            isNarrowViewport ? 'px-4 py-2 text-[13px]' : 'px-5 py-2.5 text-sm'
                          }`}
                        >
                          查看詳情 <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {sheetMode === 'expanded' && (
                    <div className="mt-6 space-y-4 pb-8">
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <h3 className="text-sm font-semibold text-slate-900 mb-2">地址</h3>
                        <p className="text-sm text-slate-600">{selectedChurchDetail?.address || selectedChurch.address || '地址待補充'}</p>
                      </div>

                      {(selectedChurchWeekdayMasses.length > 0 || selectedChurchSundayMasses.length > 0) && (
                        <div className="rounded-3xl bg-white ring-1 ring-slate-100 p-4">
                          <h3 className="text-sm font-semibold text-slate-900 mb-3">彌撒時間</h3>
                          {selectedChurchWeekdayMasses.length > 0 && (
                            <div className="mb-3">
                              <p className="mb-1 text-xs font-medium text-slate-500">平日彌撒</p>
                              <div className="space-y-1">
                                {selectedChurchWeekdayMasses.map((mass) => (
                                  <p key={mass.id} className="text-sm text-slate-700">
                                    {getMassDisplayTitle(mass)}
                                    {mass.label ? ` ・ ${mass.label}` : ''}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedChurchSundayMasses.length > 0 && (
                            <div>
                              <p className="mb-1 text-xs font-medium text-slate-500">主日彌撒</p>
                              <div className="space-y-1">
                                {selectedChurchSundayMasses.map((mass) => (
                                  <p key={mass.id} className="text-sm text-slate-700">
                                    {getMassDisplayTitle(mass)}
                                    {mass.label ? ` ・ ${mass.label}` : ''}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="rounded-3xl bg-white ring-1 ring-slate-100 p-4">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">聯絡資訊</h3>
                        <div className="space-y-3">
                          {selectedChurchDetail?.phone && (
                            <a href={`tel:${selectedChurchDetail.phone}`} className="flex items-center gap-3 text-sm text-slate-700">
                              <Phone className="h-4 w-4 text-slate-400" />
                              {selectedChurchDetail.phone}
                            </a>
                          )}
                          {selectedChurchDetail?.website && (
                            <a
                              href={selectedChurchDetail.website}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 text-sm text-slate-700"
                            >
                              <Globe className="h-4 w-4 text-slate-400" />
                              <span className="truncate">{selectedChurchDetail.website}</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `https://www.google.com/maps/search/?api=1&query=${selectedChurch.latitude},${selectedChurch.longitude}`,
                              )
                            }
                            className="flex items-center gap-3 text-sm font-medium text-blue-600"
                          >
                            <MapPin className="h-4 w-4" />
                            導航到這間教堂
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="h-full w-full bg-gray-50 pt-32 px-4 pb-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {listItems.length === 0 ? (
              <div className="text-center text-gray-500 py-10">
                {isSearchMode ? '找不到符合關鍵字的教堂' : '附近沒有即將開始的彌撒'}
              </div>
            ) : (
              listItems.map((item, idx) => {
                const parish = item.parish;
                const massTime = item.mass_time;

                return (
                  <div key={`${parish.id}-${idx}`} className="bg-white rounded-2xl p-4 shadow-sm flex gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{parish.name_zh}</h3>
                        {!isSearchMode && parish.id === nearestChurchId && (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                            最近可參與
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 mb-3">
                        {formatDistance(item.distance_km ?? parish.distance_km, parish.address)}
                      </p>

                      {massTime ? (
                        <div className="flex items-center text-sm text-gray-700 mb-4">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="line-clamp-2">
                            {formatMassCountdown(item.minutes_away) || '近期即將開始'} ({massTime.human_readable})
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 mb-4">搜尋結果來自離線資料包，進入詳情可查看照片與彌撒時間</div>
                      )}

                      <button
                        onClick={() => navigate(`/church/${parish.id}`)}
                        className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2 active:bg-blue-700 transition-colors w-fit mt-auto"
                      >
                        查看詳情 <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
