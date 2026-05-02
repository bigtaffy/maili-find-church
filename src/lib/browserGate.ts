const STORAGE_KEY = 'maili:browser-gate:last-redirect-at';
const SUPPRESSION_MS = 10 * 60 * 1000;

export type BrowserGateResult =
  | { blocked: false }
  | { blocked: true; redirectUrl: string; fallbackUrl: string };

export function getMobileBrowserGate(): BrowserGateResult {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return { blocked: false };

  const ua = navigator.userAgent;
  const isIPhone = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (!isIPhone && !isAndroid) return { blocked: false };

  const isIOSSafari =
    isIPhone &&
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|Instagram|Line|FBAN|FBAV|Messenger/i.test(ua);
  const isIOSChrome = isIPhone && /CriOS/i.test(ua);
  const isAndroidChrome =
    isAndroid &&
    /Chrome/i.test(ua) &&
    !/EdgA|OPR|SamsungBrowser|DuckDuckGo|Instagram|Line|FBAN|FBAV|Messenger/i.test(ua);

  if (isIOSSafari || isIOSChrome || isAndroidChrome) return { blocked: false };

  try {
    const last = window.localStorage.getItem(STORAGE_KEY);
    if (last) {
      const elapsed = Date.now() - Number(last);
      if (Number.isFinite(elapsed) && elapsed < SUPPRESSION_MS) return { blocked: false };
    }
  } catch {}

  const currentUrl = window.location.href;
  const withoutProtocol = currentUrl.replace(/^https?:\/\//i, '');

  return {
    blocked: true,
    redirectUrl: isAndroid
      ? `intent://${withoutProtocol}#Intent;scheme=${window.location.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(currentUrl)};end`
      : currentUrl.startsWith('https://')
        ? `googlechromes://${withoutProtocol}`
        : `googlechrome://${withoutProtocol}`,
    fallbackUrl: currentUrl,
  };
}

export function triggerBrowserGate(): boolean {
  const gate = getMobileBrowserGate();
  if (!gate.blocked) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {}

  window.location.replace(gate.redirectUrl);
  window.setTimeout(() => window.location.replace(gate.fallbackUrl), 1200);
  return true;
}
