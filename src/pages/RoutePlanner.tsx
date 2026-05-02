import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon } from 'lucide-react';

export function RoutePlanner() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 flex-1">規劃路線</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <RouteIcon className="w-8 h-8 text-gray-300" />
        </div>
        <h2 className="text-base font-bold text-gray-900 mb-1">路線規劃即將推出</h2>
        <p className="text-sm text-gray-500 mb-6">規劃你的朝聖路線，串連多間教堂一次完成</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold"
        >
          返回地圖
        </button>
      </div>
    </div>
  );
}
