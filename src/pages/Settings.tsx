import { useState } from 'react';
import {
  clearPilgrimageStamps,
  clearPilgrimageUiState,
  clearPilgrimageWishes,
  savePilgrimageStamp,
  savePilgrimageWish,
} from '@/lib/pilgrimageStorage';

const SOUTH_SONGSHAN_PARISH_ID = 632;

export function Settings() {
  const [debugMessage, setDebugMessage] = useState<string | null>(null);

  function mockSouthSongshanStamp() {
    savePilgrimageStamp({
      parish_id: SOUTH_SONGSHAN_PARISH_ID,
      stamped_at: new Date().toISOString(),
      lat: 25.0518277,
      lng: 121.5574266,
      accuracy: 20,
      verification_method: 'gps',
    });
    setDebugMessage('已模擬南松山朝聖印章');
  }

  function mockSouthSongshanWishes() {
    mockSouthSongshanStamp();

    const now = new Date().toISOString();
    savePilgrimageWish(SOUTH_SONGSHAN_PARISH_ID, 1, {
      category: 'self',
      content: '希望自己能更平靜，也更有勇氣。',
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    savePilgrimageWish(SOUTH_SONGSHAN_PARISH_ID, 2, {
      category: 'family',
      content: '希望家人平安健康。',
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    savePilgrimageWish(SOUTH_SONGSHAN_PARISH_ID, 3, {
      category: 'world',
      content: '希望世界少一點恐懼，多一點溫柔。',
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
    setDebugMessage('已模擬南松山朝聖印章與 3 張心願卡');
  }

  function clearPilgrimageDebugData() {
    clearPilgrimageStamps();
    clearPilgrimageWishes();
    clearPilgrimageUiState();
    setDebugMessage('已清除朝聖印章與心願卡測試資料');
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-medium text-slate-500">麥力找教堂</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">設定</h1>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-medium text-slate-500">目前版本</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">v{__APP_VERSION__}</p>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-amber-100">
          <p className="text-sm font-medium text-amber-600">Temporary Debug</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">朝聖印章與心願卡模擬</h2>
          <p className="mt-2 text-sm text-slate-500">
            這區是暫時測試用，會直接寫入目前裝置的 localStorage。
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={mockSouthSongshanStamp}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white active:bg-blue-700"
            >
              模擬南松山已蓋章
            </button>

            <button
              type="button"
              onClick={mockSouthSongshanWishes}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700"
            >
              模擬南松山蓋章＋3 張心願卡
            </button>

            <button
              type="button"
              onClick={clearPilgrimageDebugData}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700 active:bg-slate-200"
            >
              清除朝聖測試資料
            </button>
          </div>

          {debugMessage && <p className="mt-4 text-sm text-slate-600">{debugMessage}</p>}
        </div>
      </div>
    </div>
  );
}
