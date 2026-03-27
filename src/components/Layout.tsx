import { Outlet, useOutletContext } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useState } from 'react';

type ContextType = {
  currentView: 'map' | 'list';
  setView: (view: 'map' | 'list') => void;
};

export function Layout() {
  const [view, setView] = useState<'map' | 'list'>('map');

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-16 relative">
        <Outlet context={{ currentView: view, setView } satisfies ContextType} />
      </div>
      <BottomNav currentView={view} onViewChange={setView} />
    </div>
  );
}

export function useAppView() {
  return useOutletContext<ContextType>();
}
