import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const errorTypes = [
  '彌撒時間錯誤',
  '聯絡方式變更',
  '照片過舊',
  '神職人員資訊錯誤',
  '教堂地址或位置錯誤',
  '其他'
];

export function ReportError() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [church, setChurch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('其他');

  useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      try {
        const res = await api.getParishDetail(id);
        setChurch(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!church) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">找不到此教堂</p>
        <button onClick={() => navigate(-1)} className="bg-blue-600 text-white px-6 py-2 rounded-full">
          返回上一頁
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-900 mr-2">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">回報教堂資訊錯誤</h1>
      </div>

      <div className="px-4 py-6 flex-1 overflow-y-auto">
        <p className="text-sm text-gray-500 mb-2">回報教堂</p>
        <div className="bg-blue-50/50 rounded-2xl p-4 flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{church.name_zh}</h3>
            <p className="text-sm text-gray-500 line-clamp-1">{church.address}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-4">問題類型</h2>
        <div className="flex flex-col gap-3 mb-8">
          {errorTypes.map(type => (
            <label 
              key={type} 
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors",
                selectedType === type ? "border-blue-600 bg-blue-50/30" : "border-gray-200 bg-white"
              )}
            >
              <span className="text-gray-900">{type}</span>
              <div className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center",
                selectedType === type ? "border-blue-600" : "border-gray-300"
              )}>
                {selectedType === type && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
              </div>
              <input 
                type="radio" 
                name="errorType" 
                value={type} 
                checked={selectedType === type}
                onChange={() => setSelectedType(type)}
                className="hidden"
              />
            </label>
          ))}
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-4">詳細說明</h2>
        <textarea 
          className="w-full bg-white border border-gray-200 rounded-2xl p-4 h-32 outline-none focus:border-blue-600 resize-none text-gray-700"
          placeholder="請盡可能提供詳細資訊，例如正確的彌撒時間、新的聯絡電話等，以幫助我們加快處理速度。"
        ></textarea>
      </div>

      <div className="p-4 bg-white border-t border-gray-100 pb-safe">
        <button 
          onClick={() => {
            alert('感謝您的回報！我們會盡快處理。');
            navigate(-1);
          }}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-medium active:bg-blue-700 transition-colors"
        >
          送出回報
        </button>
      </div>
    </div>
  );
}
