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
  const [debugLines, setDebugLines] = useState<string[]>([]);

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
    const logs: string[] = [];
    try {
      // Step 1: check server version
      logs.push('1. 查詢 server 版本…');
      setDebugLines([...logs]);
      const verRes = await fetch('https://maili-news-scrapper.chihhe.dev/api/v1/sync/version', { cache: 'no-store' });
      const verJson = await verRes.json() as { version: number };
      logs.push(`   server=${verJson.version} local=${readLocalVersion()}`);
      setDebugLines([...logs]);

      // Step 2: full sync
      logs.push('2. 執行 syncOfflineData…');
      setDebugLines([...logs]);
      const result = await api.syncOfflineData(true);
      setLocalVersion(readLocalVersion());
      logs.push(`   source=${result.source} ver=${result.version} err=${result.error ?? '-'}`);
      setDebugLines([...logs]);

      if (result.source === 'remote') {
        setSyncMessage(`已更新至版本 ${result.version}`);
      } else {
        setSyncMessage(`已是最新版本（版本 ${result.version}）`);
      }
      setSyncStatus('done');
    } catch (e) {
      logs.push(`ERR: ${e instanceof Error ? e.message : String(e)}`);
      setDebugLines([...logs]);
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
          {debugLines.length > 0 && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 font-mono text-[10px] text-slate-500 break-all">
              {debugLines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-base font-semibold text-slate-900 mb-1">快取空間</h2>
          <p className="text-sm text-slate-500 mb-4">清除本地教堂快取，下次開啟將重新下載資料。</p>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(SNAPSHOT_KEY);
              setLocalVersion(null);
              setSyncMessage(null);
              setSyncStatus('idle');
              setDebugLines([]);
            }}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800 active:bg-slate-200 w-full"
          >
            清除教堂資料快取
          </button>
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
