import { useEffect, useState } from 'react';
import { clearPilgrimageStamps, clearPilgrimageUiState, clearPilgrimageWishes } from '@/lib/pilgrimageStorage';
import { api } from '@/lib/api';

const SNAPSHOT_KEY = 'maili-offline-snapshot-v1';

function readLocalVersion(): number | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.version ?? null;
  } catch {
    return null;
  }
}

export function Settings() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState<number | null>(null);

  useEffect(() => {
    setLocalVersion(readLocalVersion());
  }, []);

  function clearPilgrimageData() {
    clearPilgrimageStamps();
    clearPilgrimageWishes();
    clearPilgrimageUiState();
  }

  async function forceSync() {
    setSyncStatus('syncing');
    setSyncMessage(null);
    try {
      const result = await api.syncOfflineData(true);
      setLocalVersion(readLocalVersion());
      if (result.source === 'remote') {
        setSyncMessage(`已更新至版本 ${result.version}`);
      } else {
        setSyncMessage(`已是最新版本（版本 ${result.version}）`);
      }
      setSyncStatus('done');
    } catch {
      setSyncMessage('同步失敗，請確認網路連線');
      setSyncStatus('error');
    }
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

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-base font-semibold text-slate-900 mb-1">教堂資料</h2>
          <p className="text-sm text-slate-500 mb-3">如果看不到最新教堂或彌撒時間，可手動重新同步。</p>
          {localVersion !== null && (
            <p className="text-xs text-slate-400 mb-4">本地快取版本：{localVersion}</p>
          )}
          <button
            type="button"
            onClick={forceSync}
            disabled={syncStatus === 'syncing'}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800 active:bg-slate-200 w-full disabled:opacity-50"
          >
            {syncStatus === 'syncing' ? '同步中…' : '重新同步教堂資料'}
          </button>
          {syncMessage && (
            <p className={`mt-3 text-sm text-center ${syncStatus === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {syncMessage}
            </p>
          )}
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-base font-semibold text-slate-900 mb-1">到訪記錄與心願</h2>
          <p className="text-sm text-slate-500 mb-4">清除後無法復原，所有到訪記錄與心願卡將一併刪除。</p>
          <button
            type="button"
            onClick={clearPilgrimageData}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-rose-600 active:bg-slate-200 w-full"
          >
            清除所有到訪記錄與心願
          </button>
        </div>
      </div>
    </div>
  );
}
