import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronRight, Clock3, Church, MapPin } from 'lucide-react';
import { useFavorites } from '@/lib/useFavorites';
import { getParishSummaryById, getUpcomingMassesOffline } from '@/lib/offlineData';
import type { ParishSummary, UpcomingMass } from '@/lib/api';

type FavoriteChurch = {
  parish: ParishSummary;
  nextMass: UpcomingMass | null;
};

function formatNextMass(mass: UpcomingMass): string {
  if (!mass.next_at) return '';
  const date = new Date(mass.next_at);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });

  const dayStr = isToday ? '今天' : isTomorrow ? '明天' : date.toLocaleDateString('zh-TW', { weekday: 'short' });

  return `${dayStr} ${timeStr}`;
}

function formatCountdown(minutesAway: number | null | undefined): string | null {
  if (minutesAway == null) return null;
  if (minutesAway < 60) return `${minutesAway} 分鐘後`;
  const hours = Math.floor(minutesAway / 60);
  const mins = minutesAway % 60;
  if (mins === 0) return `${hours} 小時後`;
  return `${hours} 小時 ${mins} 分後`;
}

export function Favorites() {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavorites();

  const churches = useMemo<FavoriteChurch[]>(() => {
    return favorites
      .map(({ id }) => {
        const parish = getParishSummaryById(id);
        if (!parish) return null;

        const upcoming = getUpcomingMassesOffline(parish.latitude, parish.longitude, 0.1, 168, 50).filter(
          (m) => m.parish.id === parish.id,
        );
        const nextMass = upcoming.length > 0 ? upcoming[0] : null;

        return { parish, nextMass };
      })
      .filter((item): item is FavoriteChurch => item !== null)
      .sort((a, b) => {
        // churches with upcoming masses first
        if (a.nextMass && !b.nextMass) return -1;
        if (!a.nextMass && b.nextMass) return 1;
        if (a.nextMass && b.nextMass) {
          return (a.nextMass.minutes_away ?? 0) - (b.nextMass.minutes_away ?? 0);
        }
        return 0;
      });
  }, [favorites]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 flex-1">收藏</h1>
        {favorites.length > 0 && (
          <span className="text-sm text-gray-400">{favorites.length} 間教堂</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {churches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Church className="w-8 h-8 text-gray-300" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">尚無收藏</h2>
            <p className="text-sm text-gray-500 mb-6">在地圖上點選教堂，按愛心即可加入收藏</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold"
            >
              前往地圖探索
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 bg-white">
            {churches.map(({ parish, nextMass }) => (
              <li key={parish.id} className="flex items-center gap-3 px-4 py-4">
                <button
                  type="button"
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                  onClick={() => navigate(`/church/${parish.id}`)}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <Church className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{parish.name_zh}</p>
                    {parish.diocese && (
                      <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {parish.diocese.name_zh}
                      </p>
                    )}
                    {nextMass ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <Clock3 className="h-3 w-3 shrink-0" />
                        {formatNextMass(nextMass)}
                        {nextMass.mass_time?.language && (
                          <span className="text-gray-400">· {nextMass.mass_time.language}</span>
                        )}
                        {formatCountdown(nextMass.minutes_away) && (
                          <span className="text-gray-400">· {formatCountdown(nextMass.minutes_away)}</span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-gray-400">本週無彌撒資料</p>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(parish.id)}
                  className="shrink-0 p-2 text-red-500 active:scale-90 transition-transform"
                  aria-label="移除收藏"
                >
                  <Heart className="h-5 w-5 fill-current" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
