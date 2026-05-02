/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { ChurchDetail } from './pages/ChurchDetail';
import { Favorites } from './pages/Favorites';
import { RoutesList } from './pages/RoutesList';
import { RoutePlanner } from './pages/RoutePlanner';
import { ReportError } from './pages/ReportError';
import { Settings } from './pages/Settings';
import { api } from './lib/api';
import { triggerBrowserGate } from './lib/browserGate';

export default function App() {
  useEffect(() => {
    api.syncOfflineData().catch((error) => {
      console.warn('Initial offline sync failed:', error);
    });
  }, []);

  useEffect(() => {
    triggerBrowserGate();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="routes" element={<RoutesList />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/church/:id" element={<ChurchDetail />} />
        <Route path="/church/:id/report" element={<ReportError />} />
        <Route path="/route-planner" element={<RoutePlanner />} />
      </Routes>
    </BrowserRouter>
  );
}
