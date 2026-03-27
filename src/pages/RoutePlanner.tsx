import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Minus, Navigation, X, Menu, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api';

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

const createNumberedIcon = (number: number) => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <svg width="32" height="40" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.07));">
          <path d="M12 0C5.37258 0 0 5.37258 0 12C0 21 12 30 12 30C12 30 24 21 24 12C24 5.37258 18.6274 0 12 0Z" fill="#3b5998"/>
        </svg>
        <span style="position: absolute; top: 6px; left: 50%; transform: translateX(-50%); color: white; font-size: 12px; font-weight: bold;">
          ${number}
        </span>
      </div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
};

export function RoutePlanner() {
  const navigate = useNavigate();
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setUserLocation({ lat: 25.0478, lng: 121.5170 });
        }
      );
    } else {
      setUserLocation({ lat: 25.0478, lng: 121.5170 });
    }
  }, []);

  useEffect(() => {
    async function fetchInitialStops() {
      if (!userLocation) return;
      try {
        // Fetch some nearby churches to pre-fill for demo
        const res = await api.getNearbyParishes(userLocation.lat, userLocation.lng, 10, 2);
        if (res.data && res.data.length >= 2) {
          setStops([res.data[0], res.data[1]]);
        } else if (res.data) {
          setStops(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch initial stops:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialStops();
  }, [userLocation]);

  return (
    <div className="h-screen w-full flex flex-col relative bg-[#e5e3df]">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 z-[1000]">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">規劃朝聖路線</h1>
        <button className="text-blue-600 font-medium text-sm">清除路線</button>
      </div>

      {/* Search Bar */}
      <div className="absolute top-20 left-0 right-0 px-4 z-[1000]">
        <div className="bg-white rounded-full shadow-md flex items-center px-4 py-3">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            type="text"
            placeholder="點擊 '新增站點' 或在地圖上選擇教堂"
            className="flex-1 bg-transparent outline-none text-gray-700 text-sm"
          />
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {userLocation ? (
          <MapContainer 
            center={[userLocation.lat, userLocation.lng]} 
            zoom={13} 
            zoomControl={false}
            className="w-full h-full z-0"
          >
            <ChangeView center={[userLocation.lat, userLocation.lng]} zoom={13} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {stops.map((stop, idx) => (
              <Marker 
                key={stop.id} 
                position={[stop.latitude, stop.longitude]}
                icon={createNumberedIcon(idx + 1)}
              />
            ))}
          </MapContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-50">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}
        
        {/* Map Controls */}
        <div className="absolute right-4 bottom-32 flex flex-col gap-2 z-[1000]">
          <button 
            className="bg-white rounded-lg shadow-md p-3 active:bg-gray-50"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setUserLocation({
                      lat: position.coords.latitude,
                      lng: position.coords.longitude
                    });
                  }
                );
              }
            }}
          >
            <Navigation className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-6 pb-8 z-[1000] flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 max-h-64">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : stops.map((stop, idx) => (
            <div key={stop.id} className="flex items-center gap-3 py-4 border-b border-gray-100 last:border-0">
              <Menu className="w-5 h-5 text-gray-400 cursor-grab" />
              <div className="w-6 h-6 rounded-full bg-[#3b5998] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {idx + 1}
              </div>
              <div className="flex-1 ml-1">
                <h3 className="text-base font-bold text-gray-900">{stop.name_zh}</h3>
                <p className="text-sm text-gray-500">預計停留: {idx === 0 ? '15' : '30'} 分鐘</p>
              </div>
              <button className="p-2 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">路線</h3>
            <p className="text-sm text-gray-500 mb-4">總里程: 25 公里</p>
            <button className="bg-[#3b5998] text-white px-6 py-2.5 rounded-xl text-sm font-medium active:bg-blue-800 transition-colors">
              開始導航
            </button>
          </div>
          <div className="w-24 h-24 bg-blue-100 rounded-xl overflow-hidden relative shadow-inner">
            <div className="absolute inset-0 opacity-50" style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '10px 10px'
            }}></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 border-2 border-dashed border-red-400 rounded-lg"></div>
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500 rounded-full"></div>
            <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-red-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
