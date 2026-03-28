import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { clearPilgrimageWish, getPilgrimageStamp, getPilgrimageWishesByParish, savePilgrimageWish } from '@/lib/pilgrimageStorage';
import type { PilgrimageStamp, PilgrimageWish, PilgrimageWishSlots, WishStatus } from '@/lib/types';
import { getLiturgyDisplayTitle, getMassDisplayTitle, getMassSection, sortMassTimes } from '@/lib/utils';
import { useFavorites } from '@/lib/useFavorites';

const FALLBACK_CHURCH_IMAGE =
  'https://images.unsplash.com/photo-1548625361-ec846e2e92c2?auto=format&fit=crop&q=80&w=1200';
const OPEN_FREE_MAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const WISH_SLOT_META = [
  { slot: 1 as const, title: '為自己', category: 'self' as const },
  { slot: 2 as const, title: '為家人', category: 'family' as const },
  { slot: 3 as const, title: '為世界', category: 'world' as const },
];

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
  const [wishDraft, setWishDraft] = useState<{ content: string; status: WishStatus }>({
    content: '',
    status: 'pending',
  });

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

  useEffect(() => {
    if (!editingWishSlot || !pilgrimageWishes) return;
    const wish = pilgrimageWishes[editingWishSlot];
    setWishDraft({
      content: wish?.content ?? '',
      status: wish?.status ?? 'pending',
    });
  }, [editingWishSlot, pilgrimageWishes]);

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
        <button onClick={() => navigate(-1)} className="bg-blue-600 text-white px-6 py-2 rounded-full">
          返回上一頁
        </button>
      </div>
    );
  }

  const isFav = isFavorite(church.id);
  const mainImage = church.photos?.[0]?.image_url || FALLBACK_CHURCH_IMAGE;
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

  function startEditingWish(slot: 1 | 2 | 3) {
    const wish = pilgrimageWishes?.[slot] ?? null;
    setWishDraft({
      content: wish?.content ?? '',
      status: wish?.status ?? 'pending',
    });
    setEditingWishSlot(slot);
  }

  function cancelWishEditing() {
    setEditingWishSlot(null);
    setWishDraft({ content: '', status: 'pending' });
  }

  function handleSaveWish(slot: 1 | 2 | 3, category: 'self' | 'family' | 'world') {
    const content = wishDraft.content.trim();
    if (!content) return;

    const existingWish = pilgrimageWishes?.[slot] ?? null;
    const now = new Date().toISOString();
    const payload: PilgrimageWish = {
      category,
      content,
      status: wishDraft.status,
      created_at: existingWish?.created_at ?? now,
      updated_at: now,
    };

    savePilgrimageWish(church.id, slot, payload);
    refreshPilgrimageState();
    cancelWishEditing();
  }

  function handleClearWish(slot: 1 | 2 | 3) {
    clearPilgrimageWish(church.id, slot);
    refreshPilgrimageState();
    if (editingWishSlot === slot) {
      cancelWishEditing();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="relative h-64">
        <img
          src={mainImage}
          alt={church.name_zh}
          className="w-full h-full object-cover"
          onError={(event) => {
            event.currentTarget.src = FALLBACK_CHURCH_IMAGE;
          }}
        />
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={() => navigate(-1)} className="p-2 text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <button onClick={() => toggleFavorite(church.id)} className="p-2 text-white">
            <Star className="w-6 h-6" fill={isFav ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{church.name_zh}</h1>
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
                  {getMassDisplayTitle(m)} {m.label ? `(${m.label})` : ''}
                </p>
              ))}
            </div>
          )}

          {sundayMasses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 mb-1">主日彌撒</h3>
              {sundayMasses.map((m) => (
                <p key={m.id} className="text-sm text-gray-500">
                  {getMassDisplayTitle(m)} {m.label ? `(${m.label})` : ''}
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

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">朝聖印章</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isPilgrimageUnlocked ? '這間教堂已完成首次到訪記錄' : '第一次到訪並完成蓋章後，會解鎖心願卡'}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPilgrimageUnlocked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isPilgrimageUnlocked ? '已蓋章' : '未蓋章'}
            </span>
          </div>

          {isPilgrimageUnlocked ? (
            <div className="rounded-2xl bg-emerald-50/70 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-800">已留下朝聖印章</p>
              <p className="mt-1 text-sm text-emerald-700">
                {pilgrimageStamp?.stamped_at
                  ? `蓋章時間：${new Date(pilgrimageStamp.stamped_at).toLocaleString('zh-TW')}`
                  : '已完成蓋章'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-600">目前還沒有這間教堂的朝聖印章。</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">心願卡</h2>
              <p className="mt-1 text-sm text-slate-500">每間教堂只有第一次到訪並完成蓋章後，才會解鎖 3 張心願卡。</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPilgrimageUnlocked ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isPilgrimageUnlocked ? `已解鎖 ${filledWishCount}/3` : '尚未解鎖'}
            </span>
          </div>

          {!isPilgrimageUnlocked ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              先完成這間教堂的首次蓋章，才會開啟三個願望欄位。
            </div>
          ) : (
            <div className="space-y-3">
              {WISH_SLOT_META.map(({ slot, title, category }) => {
                const wish = pilgrimageWishes?.[slot] ?? null;
                const isEditing = editingWishSlot === slot;
                return (
                  <div key={slot} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{title}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${wish ? 'bg-white text-slate-600' : 'bg-white text-slate-400'}`}>
                        {wish ? '已許願' : '尚未填寫'}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={wishDraft.content}
                          onChange={(event) => setWishDraft((current) => ({ ...current, content: event.target.value }))}
                          rows={4}
                          placeholder="寫下這次想放在這裡的心願"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                        />
                        <div>
                          <p className="mb-2 text-xs font-medium text-slate-500">狀態</p>
                          <select
                            value={wishDraft.status}
                            onChange={(event) => setWishDraft((current) => ({ ...current, status: event.target.value as WishStatus }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400"
                          >
                            <option value="pending">靜待中</option>
                            <option value="fulfilled">已實現</option>
                            <option value="released">放下了</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveWish(slot, category)}
                            disabled={!wishDraft.content.trim()}
                            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                          >
                            儲存
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
                        <p className="text-sm text-slate-700">{wish.content}</p>
                        <p className="mt-2 text-xs text-slate-500">狀態：{getWishStatusLabel(wish.status)}</p>
                        <p className="mt-1 text-xs text-slate-400">最後更新：{new Date(wish.updated_at).toLocaleDateString('zh-TW')}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingWish(slot)}
                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearWish(slot)}
                            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-200"
                          >
                            清除
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-slate-500">這張心願卡還是空白的。</p>
                        <button
                          type="button"
                          onClick={() => startEditingWish(slot)}
                          className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                        >
                          新增心願
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
    </div>
  );
}
