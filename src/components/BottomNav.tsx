import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Map, Heart, Route as RouteIcon, Settings, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BottomNav({ currentView, onViewChange }: { currentView?: 'map' | 'list', onViewChange?: (view: 'map' | 'list') => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 pb-safe z-50">
      <div
        className={cn("flex flex-col items-center justify-center w-full h-full cursor-pointer", isHome ? "text-blue-600" : "text-gray-500")}
        onClick={() => {
          if (isHome && onViewChange) {
            onViewChange(currentView === 'map' ? 'list' : 'map');
          } else {
            navigate('/');
          }
        }}
      >
        {currentView === 'list' ? <List className="w-6 h-6" /> : <Map className="w-6 h-6" />}
        <span className="text-[10px] mt-1">{currentView === 'list' ? '列表' : '地圖'}</span>
      </div>
      <NavLink
        to="/favorites"
        className={({ isActive }) =>
          cn("flex flex-col items-center justify-center w-full h-full", isActive ? "text-blue-600" : "text-gray-500")
        }
      >
        <Heart className="w-6 h-6" />
        <span className="text-[10px] mt-1">收藏</span>
      </NavLink>
      <NavLink
        to="/routes"
        className={({ isActive }) =>
          cn("flex flex-col items-center justify-center w-full h-full", isActive ? "text-blue-600" : "text-gray-500")
        }
      >
        <RouteIcon className="w-6 h-6" />
        <span className="text-[10px] mt-1">路線</span>
      </NavLink>
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          cn("flex flex-col items-center justify-center w-full h-full", isActive ? "text-blue-600" : "text-gray-500")
        }
      >
        <Settings className="w-6 h-6" />
        <span className="text-[10px] mt-1">設定</span>
      </NavLink>
    </div>
  );
}
