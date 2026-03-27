import { useState, useEffect, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2, Trash2, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useFavorites } from '@/lib/useFavorites';

export function Favorites() {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useFavorites();
  const [favoriteChurches, setFavoriteChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function fetchFavorites() {
      if (favorites.length === 0) {
        setFavoriteChurches([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch details for all favorite IDs
        const promises = favorites.map(id => api.getParishDetail(id).catch(() => null));
        const results = await Promise.all(promises);
        
        // Filter out failed requests and extract data
        const validChurches = results
          .filter(res => res && res.data)
          .map(res => res.data);
          
        setFavoriteChurches(validChurches);
      } catch (error) {
        console.error('Failed to fetch favorite churches:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchFavorites();
  }, [favorites]);

  const handleRemove = (e: MouseEvent, id: number) => {
    e.stopPropagation();
    toggleFavorite(id);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">我的最愛</h1>
        <button 
          onClick={() => setIsEditing(!isEditing)} 
          className="text-blue-600 font-medium text-sm"
        >
          {isEditing ? '完成' : '編輯'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : favoriteChurches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Star className="w-8 h-8 text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">尚無收藏</h2>
            <p className="text-gray-500 text-sm">您還沒有收藏任何教堂，去地圖上探索看看吧！</p>
            <button 
              onClick={() => navigate('/')}
              className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-medium"
            >
              前往探索
            </button>
          </div>
        ) : (
          favoriteChurches.map((church, idx) => {
            const mainImage = church.photos && church.photos.length > 0 
              ? church.photos[0].image_url 
              : 'https://images.unsplash.com/photo-1548625361-ec846e2e92c2?auto=format&fit=crop&q=80&w=1000';

            return (
              <div 
                key={church.id} 
                className={`bg-white px-4 py-4 flex items-center gap-4 cursor-pointer ${idx !== favoriteChurches.length - 1 ? 'border-b border-gray-100' : ''}`}
                onClick={() => !isEditing && navigate(`/church/${church.id}`)}
              >
                {isEditing && (
                  <button 
                    onClick={(e) => handleRemove(e, church.id)}
                    className="p-2 text-red-500 bg-red-50 rounded-full mr-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <img src={mainImage} alt={church.name_zh} className="w-16 h-16 rounded-xl object-cover" />
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">{church.name_zh}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1">{church.address}</p>
                </div>
                {!isEditing && <ChevronRight className="w-5 h-5 text-gray-400" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
