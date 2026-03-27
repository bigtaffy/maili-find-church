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

function getMobileBrowserGate() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return { blocked: false };

  const ua = navigator.userAgent;
  const isIPhone = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIPhone || isAndroid;

  if (!isMobile) return { blocked: false };

  const isIOSSafari =
    isIPhone &&
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|Line|FBAN|FBAV|Messenger/i.test(ua);

  const isIOSChrome = isIPhone && /CriOS/i.test(ua);

  const isAndroidChrome =
    isAndroid &&
    /Chrome/i.test(ua) &&
    !/EdgA|OPR|SamsungBrowser|DuckDuckGo|Instagram|Line|FBAN|FBAV|Messenger/i.test(ua);

  if (isIOSSafari || isIOSChrome || isAndroidChrome) {
    return { blocked: false };
  }

  const currentUrl = window.location.href;
  const currentWithoutProtocol = currentUrl.replace(/^https?:\/\//i, '');

  return {
    blocked: true,
    isIPhone,
    redirectUrl: isAndroid
      ? `intent://${currentWithoutProtocol}#Intent;scheme=${window.location.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
      : currentUrl.startsWith('https://')
        ? `googlechromes://${currentWithoutProtocol}`
        : `googlechrome://${currentWithoutProtocol}`,
    fallbackUrl: currentUrl,
  };
}

export default function App() {
  const browserGate = getMobileBrowserGate();

  useEffect(() => {
    api.syncOfflineData().catch((error) => {
      console.warn('Initial offline sync failed:', error);
    });
  }, []);

  useEffect(() => {
    if (!browserGate.blocked) return;

    window.location.replace(browserGate.redirectUrl);

    const fallbackTimer = window.setTimeout(() => {
      window.location.replace(browserGate.fallbackUrl);
    }, 1200);

    return () => window.clearTimeout(fallbackTimer);
  }, [browserGate]);

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
