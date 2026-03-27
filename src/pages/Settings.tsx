export function Settings() {
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
      </div>
    </div>
  );
}
