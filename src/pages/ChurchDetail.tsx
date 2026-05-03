import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import {
  ArrowLeft,
  Star,
  Navigation,
  Phone,
  Mail,
  Globe,
  Edit3,
  MapPin,
  Loader2,
  Clock3,
  ExternalLink,
  Map,
  ChevronRight,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import MapGL, { Marker } from 'react-map-gl/maplibre';
import { api, type ParishDetail, type UpcomingMass } from '@/lib/api';
import { clearPilgrimageWish, getPilgrimageStamp, getPilgrimageWishesByParish, savePilgrimageStamp, savePilgrimageWish } from '@/lib/pilgrimageStorage';
import type { PilgrimageStamp, PilgrimageWish, PilgrimageWishSlots, WishStatus } from '@/lib/types';
import { getLiturgyDisplayTitle, getMassDisplayTitle, getMassSection, shouldShowLocalName, sortMassTimes } from '@/lib/utils';
import { useFavorites } from '@/lib/useFavorites';
import { triggerBrowserGate } from '@/lib/browserGate';

const FALLBACK_CHURCH_IMAGE =
  'https://images.unsplash.com/photo-1548625361-ec846e2e92c2?auto=format&fit=crop&q=80&w=1200';
const OPEN_FREE_MAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const WISH_SLOT_META = [
  { slot: 1 as const, title: '為自己', category: 'self' as const },
  { slot: 2 as const, title: '為家人', category: 'family' as const },
  { slot: 3 as const, title: '為世界', category: 'world' as const },
];

const GPS_MAX_DISTANCE_M = 100;

function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getWishStatusLabel(status: WishStatus) {
  if (status === 'fulfilled') return '已實現';
  if (status === 'released') return '放下了';
  return '靜待中';
}

function formatMassCountdown(minutesAway?: number | null) {
  if (minutesAway == null) return null;
  if (minutesAway < 60) return `${minutesAway} 分鐘後`;
  const hours = Math.floor(minutesAway / 60);
  const minutes = minutesAway % 60;
  if (minutes === 0) return `${hours} 小時後`;
  return `${hours} 小時 ${minutes} 分鐘後`;
}

function getMapAppOptions(church: ParishDetail) {
  const lat = church.latitude;
  const lng = church.longitude;
  const label = encodeURIComponent(church.name_zh);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  const options = [];

  if (isIOS) {
    options.push({
      label: 'Apple 地圖',
      description: '直接用 iPhone 內建地圖導航',
      href: `https://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
    });
  }

  if (isAndroid) {
    options.push({
      label: 'Google 地圖 App',
      description: '優先嘗試開啟 Android 地圖應用',
      href: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    });
  }

  options.push({
    label: 'Google 地圖',
    description: '瀏覽器或已安裝 App 均可接手',
    href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });

  options.push({
    label: 'OpenStreetMap',
    description: '直接在瀏覽器查看位置',
    href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  });

  return options;
}

export function ChurchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [church, setChurch] = useState<ParishDetail | null>(null);
  const [nextMass, setNextMass] = useState<UpcomingMass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMapApps, setShowMapApps] = useState(false);
  const [pilgrimageStamp, setPilgrimageStamp] = useState<PilgrimageStamp | null>(null);
  const [pilgrimageWishes, setPilgrimageWishes] = useState<PilgrimageWishSlots | null>(null);
  const [editingWishSlot, setEditingWishSlot] = useState<1 | 2 | 3 | null>(null);
  const [wishDraft, setWishDraft] = useState<string>('');
  const [stampLoading, setStampLoading] = useState(false);
  const [stampError, setStampError] = useState<string | null>(null);

  // Force native browser on direct-link open (independent of App.tsx gate)
  useEffect(() => {
    triggerBrowserGate();
  }, []);

  // Dynamic document title + OG meta tags
  useEffect(() => {
    if (!church) return;

    const defaultTitle = '麥力找教堂';
    const pageTitle = `${church.name_zh} - ${defaultTitle}`;
    const description = church.address
      ? `${church.name_zh}，位於 ${church.address}。查看彌撒時間與聯絡資訊。`
      : `${church.name_zh} 彌撒時間與聯絡資訊。`;
    const image = church.photos?.[0]?.image_url || FALLBACK_CHURCH_IMAGE;
    const canonicalUrl = `${window.location.origin}/church/${church.id}`;

    document.title = pageTitle;

    function setMeta(property: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    }

    setMeta('og:title', pageTitle);
    setMeta('og:description', description);
    setMeta('og:image', image);
    setMeta('og:url', canonicalUrl);
    setMeta('og:type', 'place');
    setMeta('og:locale', 'zh_TW');

    return () => {
      document.title = defaultTitle;
      ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:locale'].forEach((p) => {
        document.querySelector(`meta[property="${p}"]`)?.remove();
      });
    };
  }, [church]);

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const res = await api.getParishDetail(id);
        setChurch(res.data);

        const upcomingRes = await api.getUpcomingMasses(res.data.latitude, res.data.longitude, 0.2, 168, 8);
        setNextMass(upcomingRes.data.find((item) => item.parish.id === res.data.id) ?? null);
      } catch (err) {
        console.error(err);
        setError('無法載入教堂資料');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!church?.id) return;

    const syncPilgrimageState = () => {
      setPilgrimageStamp(getPilgrimageStamp(church.id));
      setPilgrimageWishes(getPilgrimageWishesByParish(church.id));
    };

    syncPilgrimageState();
    window.addEventListener('focus', syncPilgrimageState);
    window.addEventListener('storage', syncPilgrimageState);

    return () => {
      window.removeEventListener('focus', syncPilgrimageState);
      window.removeEventListener('storage', syncPilgrimageState);
    };
  }, [church?.id]);

  const mapAppOptions = useMemo(() => (church ? getMapAppOptions(church) : []), [church]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !church) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">{error || '找不到此教堂'}</p>
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="bg-blue-600 text-white px-6 py-2 rounded-full">
          返回上一頁
        </button>
      </div>
    );
  }

  const isFav = isFavorite(church.id);
  const photos = church.photos?.length ? church.photos : [{ image_url: FALLBACK_CHURCH_IMAGE, description: null }];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoVisible, setPhotoVisible] = useState(true);
  const photoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (photos.length <= 1) return;
    const tick = () => {
      setPhotoVisible(false);
      photoTimerRef.current = setTimeout(() => {
        setPhotoIndex((i) => (i + 1) % photos.length);
        setPhotoVisible(true);
      }, 600); // fade-out duration
    };
    const interval = setInterval(tick, 2600); // 2s visible + 0.6s fade
    return () => { clearInterval(interval); if (photoTimerRef.current) clearTimeout(photoTimerRef.current); };
  }, [photos.length]);
  const sundayMasses = sortMassTimes(church.mass_times?.filter((m) => getMassSection(m) === 'sunday') || []);
  const weekdayMasses = sortMassTimes(church.mass_times?.filter((m) => getMassSection(m) === 'weekday') || []);
  const specialMasses = sortMassTimes(church.mass_times?.filter((m) => getMassSection(m) === 'special') || []);
  const liturgyItems = sortMassTimes(church.mass_times?.filter((m) => getMassSection(m) === 'liturgy') || []);
  const isPilgrimageUnlocked = Boolean(pilgrimageStamp);
  const filledWishCount = pilgrimageWishes ? [pilgrimageWishes[1], pilgrimageWishes[2], pilgrimageWishes[3]].filter(Boolean).length : 0;

  function refreshPilgrimageState() {
    setPilgrimageStamp(getPilgrimageStamp(church.id));
    setPilgrimageWishes(getPilgrimageWishesByParish(church.id));
  }

  function handleGpsStamp() {
    if (!navigator.geolocation) {
      setStampError('此裝置不支援定位服務');
      return;
    }
    setStampLoading(true);
    setStampError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistanceM(pos.coords.latitude, pos.coords.longitude, church.latitude, church.longitude);
        if (dist <= GPS_MAX_DISTANCE_M) {
          savePilgrimageStamp({
            parish_id: church.id,
            stamped_at: new Date().toISOString(),
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
            verification_method: 'gps',
          });
          refreshPilgrimageState();
          setStampError(null);
        } else {
          setStampError(`你目前距離此堂約 ${Math.round(dist)} 公尺，需要到現場才能記錄`);
        }
        setStampLoading(false);
      },
      () => {
        setStampError('無法取得位置，請確認已開啟定位服務');
        setStampLoading(false);
      },
      { timeout: 10000, maximumAge: 30000 },
    );
  }

  function startWritingWish(slot: 1 | 2 | 3) {
    setWishDraft('');
    setEditingWishSlot(slot);
  }

  function cancelWishEditing() {
    setEditingWishSlot(null);
    setWishDraft('');
  }

  function handleSaveWish(slot: 1 | 2 | 3, category: 'self' | 'family' | 'world') {
    const content = wishDraft.trim();
    if (!content) return;
    const now = new Date().toISOString();
    const payload: PilgrimageWish = {
      category,
      content,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    savePilgrimageWish(church.id, slot, payload);
    refreshPilgrimageState();
    cancelWishEditing();
  }

  function handleUpdateStatus(slot: 1 | 2 | 3, newStatus: WishStatus) {
    const wish = pilgrimageWishes?.[slot];
    if (!wish) return;
    savePilgrimageWish(church.id, slot, { ...wish, status: newStatus, updated_at: new Date().toISOString() });
    refreshPilgrimageState();
  }

  function handleClearWish(slot: 1 | 2 | 3) {
    clearPilgrimageWish(church.id, slot);
    refreshPilgrimageState();
    if (editingWishSlot === slot) cancelWishEditing();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="relative h-64 overflow-hidden">
        <img
          src={photos[photoIndex]?.image_url || FALLBACK_CHURCH_IMAGE}
          alt={church.name_zh}
          className="w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: photoVisible ? 1 : 0 }}
          onError={(event) => { event.currentTarget.src = FALLBACK_CHURCH_IMAGE; }}
        />
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <span key={i} className={`block h-1.5 rounded-full transition-all duration-300 ${i === photoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="p-2 text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button onClick={() => toggleFavorite(church.id)} className="p-2 text-white">
            <Star className="w-6 h-6" fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{church.name_zh}</h1>
          {shouldShowLocalName(church.diocese?.id, church.name_zh, church.name_local) && (
            <p className="text-sm text-slate-400 mb-1">{church.name_local}</p>
          )}
          <p className="text-sm text-gray-500 mb-4">{church.address}</p>

          <div className="rounded-2xl bg-slate-50 p-4 mb-5">
            <div className="flex items-center gap-2 text-slate-700 mb-2">
              <Clock3 className="w-4 h-4" />
              <span className="text-sm font-semibold">最近彌撒</span>
            </div>
            {nextMass?.mass_time ? (
              <>
                <p className="text-base font-semibold text-slate-900">
                  {getMassDisplayTitle(nextMass.mass_time)}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {formatMassCountdown(nextMass.minutes_away) || '近期即將開始'}
                  {nextMass.mass_time.label ? ` ・ ${nextMass.mass_time.label}` : ''}
                  {nextMass.mass_time.location_note ? ` ・ ${nextMass.mass_time.location_note}` : ''}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">暫時找不到近期彌撒，下面仍可查看此堂區的固定彌撒時間。</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => setShowMapApps(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-full font-medium flex justify-center items-center gap-2 active:bg-blue-700"
            >
              <Navigation className="w-5 h-5" /> 開啟地圖 App
            </button>
            <button
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${church.latitude},${church.longitude}`)}
              className="w-full bg-slate-100 text-slate-800 py-3 rounded-full font-medium flex justify-center items-center gap-2 active:bg-slate-200"
            >
              <Map className="w-5 h-5" /> 在瀏覽器看地圖
            </button>
          </div>
        </div>

        {church.priests && church.priests.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">堂區神職</h2>
            <div className="flex flex-col gap-3">
              {church.priests.map((priest, index) => (
                <div key={`${priest.id ?? priest.name_zh ?? 'priest'}-${index}`} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{priest.name_zh || priest.name_en || '未提供姓名'}</p>
                    <p className="text-sm text-gray-500">{priest.title || priest.role || '神職人員'}</p>
                  </div>
                  {priest.is_active && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                      現任
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">彌撒時間</h2>

          {weekdayMasses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 mb-1">平日彌撒</h3>
              {weekdayMasses.map((m) => (
                <p key={m.id} className="text-sm text-gray-500">
                  {getMassDisplayTitle(m)}
                  {m.language && <span className="text-gray-400"> · {m.language}</span>}
                  {m.label && <span> ({m.label})</span>}
                </p>
              ))}
            </div>
          )}

          {sundayMasses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 mb-1">主日彌撒</h3>
              {sundayMasses.map((m) => (
                <p key={m.id} className="text-sm text-gray-500">
                  {getMassDisplayTitle(m)}
                  {m.language && <span className="text-gray-400"> · {m.language}</span>}
                  {m.label && <span> ({m.label})</span>}
                </p>
              ))}
            </div>
          )}

          {specialMasses.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-1">特殊彌撒</h3>
              {specialMasses.map((m) => (
                <p key={m.id} className="text-sm text-gray-500">
                  {m.label || m.remarks || m.mass_type?.name_zh ? `${m.label || m.remarks || m.mass_type?.name_zh}：` : ''}
                  {getMassDisplayTitle(m)}
                </p>
              ))}
            </div>
          )}

          {liturgyItems.length > 0 && (
            <div className={specialMasses.length > 0 ? 'mt-4' : ''}>
              <h3 className="font-bold text-gray-900 mb-1">其他禮儀</h3>
              {liturgyItems.map((m) => (
                <p key={m.id} className="text-sm text-gray-500">
                  {getLiturgyDisplayTitle(m)}：{getMassDisplayTitle(m)}
                </p>
              ))}
            </div>
          )}

          {(!church.mass_times || church.mass_times.length === 0) && (
            <p className="text-sm text-gray-500">暫無彌撒時間資訊</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">聯絡資訊</h2>
          <div className="flex flex-col gap-4">
            {church.phone && (
              <div className="flex items-center gap-3 text-blue-600">
                <Phone className="w-5 h-5 text-gray-400" />
                <a href={`tel:${church.phone}`} className="text-sm">{church.phone}</a>
              </div>
            )}
            {church.email && (
              <div className="flex items-center gap-3 text-blue-600">
                <Mail className="w-5 h-5 text-gray-400" />
                <a href={`mailto:${church.email}`} className="text-sm">{church.email}</a>
              </div>
            )}
            {church.website && (
              <div className="flex items-center gap-3 text-blue-600">
                <Globe className="w-5 h-5 text-gray-400" />
                <a href={church.website} target="_blank" rel="noopener noreferrer" className="text-sm truncate">
                  {church.website}
                </a>
              </div>
            )}
            {!church.phone && !church.email && !church.website && (
              <p className="text-sm text-gray-500">暫無聯絡資訊</p>
            )}
          </div>
        </div>

        {/* 到訪記錄 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">到訪記錄</h2>
            {isPilgrimageUnlocked && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                已到訪
              </span>
            )}
          </div>

          {isPilgrimageUnlocked ? (
            <div className="rounded-2xl bg-emerald-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800">你曾經到訪過這間教堂</p>
              <p className="mt-1 text-sm text-emerald-700">
                首次到訪：{new Date(pilgrimageStamp!.stamped_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                到達教堂後，記錄你的第一次到訪。GPS 會確認你確實在現場（500 公尺以內）。到訪後可以許下三個心願。
              </p>
              <button
                type="button"
                onClick={handleGpsStamp}
                disabled={stampLoading}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white active:bg-blue-700 disabled:bg-blue-300"
              >
                {stampLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    定位中…
                  </>
                ) : (
                  '記錄到訪'
                )}
              </button>
              {stampError && (
                <p className="text-center text-sm text-rose-600">{stampError}</p>
              )}
              {/* DEV ONLY */}
              <button
                type="button"
                onClick={() => {
                  savePilgrimageStamp({ parish_id: church.id, stamped_at: new Date().toISOString(), lat: church.latitude, lng: church.longitude, accuracy: null, verification_method: 'manual' });
                  refreshPilgrimageState();
                }}
                className="w-full rounded-full border border-dashed border-slate-300 py-2 text-xs text-slate-400 active:bg-slate-50"
              >
                [Dev] 略過 GPS，直接解鎖
              </button>
            </div>
          )}
        </div>

        {/* 心願 */}
        {isPilgrimageUnlocked && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900">三個心願</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {filledWishCount}/3
              </span>
            </div>

            <div className="space-y-3">
              {WISH_SLOT_META.map(({ slot, title, category }) => {
                const wish = pilgrimageWishes?.[slot] ?? null;
                const isEditing = editingWishSlot === slot;

                return (
                  <div key={slot} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={wishDraft}
                          onChange={(e) => setWishDraft(e.target.value)}
                          rows={4}
                          autoFocus
                          placeholder="寫下你的心願…"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveWish(slot, category)}
                            disabled={!wishDraft.trim()}
                            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-blue-300"
                          >
                            記下心願
                          </button>
                          <button
                            type="button"
                            onClick={cancelWishEditing}
                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : wish ? (
                      <>
                        <p className="text-sm text-slate-800 leading-relaxed">{wish.content}</p>
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(wish.created_at).toLocaleDateString('zh-TW')} 許願
                        </p>
                        {/* 狀態 tap 按鈕 */}
                        <div className="mt-3 flex items-center gap-2">
                          {(['pending', 'fulfilled', 'released'] as WishStatus[]).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleUpdateStatus(slot, s)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                wish.status === s
                                  ? s === 'fulfilled'
                                    ? 'bg-amber-400 text-white'
                                    : s === 'released'
                                      ? 'bg-slate-400 text-white'
                                      : 'bg-blue-500 text-white'
                                  : 'bg-white text-slate-500 ring-1 ring-slate-200'
                              }`}
                            >
                              {getWishStatusLabel(s)}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleClearWish(slot)}
                            className="ml-auto text-xs text-rose-400 active:text-rose-600"
                          >
                            清除
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startWritingWish(slot)}
                        className="mt-1 text-sm text-blue-600 font-medium active:text-blue-800"
                      >
                        + 許下心願
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">地圖</h2>
            <button
              type="button"
              onClick={() => setShowMapApps(true)}
              className="text-sm font-medium text-blue-600 flex items-center gap-1"
            >
              開啟 App <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full h-56 rounded-2xl overflow-hidden ring-1 ring-slate-200">
            <MapGL
              mapLib={maplibregl}
              initialViewState={{
                latitude: church.latitude,
                longitude: church.longitude,
                zoom: 15.5,
              }}
              minZoom={5.2}
              maxZoom={18}
              dragRotate={false}
              touchZoomRotate={false}
              style={{ width: '100%', height: '100%' }}
              mapStyle={OPEN_FREE_MAP_LIBERTY_STYLE}
            >
              <Marker longitude={church.longitude} latitude={church.latitude} anchor="bottom">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600/18 p-1 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                  <div className="flex h-full w-full items-center justify-center rounded-full border border-white/80 bg-blue-600 text-white ring-2 ring-blue-100/80">
                    <MapPin className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                </div>
              </Marker>
            </MapGL>
          </div>

          <div className="mt-3 text-sm text-slate-500">
            可拖曳查看附近街區，點上方按鈕可直接交給外部地圖 App 導航。
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">資料回報</h2>
          <p className="text-xs text-gray-500 mb-4">發現資訊有誤或需要更新嗎？協助我們讓資料保持最新！</p>
          <button
            onClick={() => navigate(`/church/${church.id}/report`)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium flex justify-center items-center gap-2 active:bg-blue-700"
          >
            <Edit3 className="w-5 h-5" /> 回報資訊錯誤或更新
          </button>
        </div>
      </div>

      {showMapApps && (
        <div className="fixed inset-0 z-[1200] bg-black/35 backdrop-blur-[2px] flex items-end">
          <div className="w-full rounded-t-3xl bg-white px-5 pt-4 pb-8 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-300" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">開啟地圖 App</h3>
                <p className="text-sm text-slate-500">依裝置平台提供最適合的地圖選項</p>
              </div>
              <button type="button" onClick={() => setShowMapApps(false)} className="rounded-full bg-slate-100 p-2 text-slate-600">
                <ChevronRight className="h-5 w-5 rotate-90" />
              </button>
            </div>

            <div className="space-y-3">
              {mapAppOptions.map((option) => (
                <a
                  key={option.label}
                  href={option.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4 active:bg-slate-100"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{option.label}</p>
                    <p className="text-sm text-slate-500">{option.description}</p>
                  </div>
                  <ExternalLink className="h-5 w-5 text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
