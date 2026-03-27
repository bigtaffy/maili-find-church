import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit2, Trash2 } from 'lucide-react';
import { savedRoutes } from '@/data/mockData';

export function RoutesList() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">朝聖路線</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">我的路線</h2>
          <button 
            onClick={() => navigate('/route-planner')}
            className="text-blue-600 font-medium text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 新增路線
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {savedRoutes.map(route => (
            <div key={route.id} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">{route.name}</h3>
                <div className="flex gap-3 text-gray-400">
                  <button><Edit2 className="w-5 h-5" /></button>
                  <button><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2 leading-relaxed">{route.destinations}</p>
              <p className="text-sm text-gray-600 mb-1">總里程：{route.distance}</p>
              <p className="text-sm text-gray-600 mb-6">預計時間：{route.time}</p>
              
              <button className="w-full bg-[#3b5998] text-white py-3 rounded-xl font-medium active:bg-blue-800 transition-colors">
                查看路線
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
