/// <reference types="@cloudflare/workers-types" />

const API_BASE = 'https://maili-news-scrapper.chihhe.dev';
const APP_NAME = '麥力找教堂';
// Replace with a real 1200×630 branded banner at https://churches.mai-li.app/og-default.jpg
const DEFAULT_OG_IMAGE =
  'https://images.unsplash.com/photo-1548625361-ec846e2e92c2?auto=format&fit=crop&q=80&w=1200';

type ParishMeta = { name_zh: string; address: string | null; photo: string | null };
type SnapshotParish = { id: number; name_zh: string; address?: string | null };
type SnapshotPhoto = { parish_id: number; image_url?: string | null };

// In-process cache — lives as long as the Worker isolate is warm
let cachedMeta: Map<number, ParishMeta> | null = null;
let cachedVersion: number | null = null;

async function getParishMeta(id: number): Promise<ParishMeta | null> {
  try {
    const versionRes = await fetch(`${API_BASE}/api/v1/sync/version`, {
      // @ts-ignore cf is a Cloudflare-specific fetch option
      cf: { cacheTtl: 120, cacheEverything: true },
    });
    if (!versionRes.ok) return null;
    const { version } = (await versionRes.json()) as { version: number };

    if (cachedMeta && cachedVersion === version) {
      return cachedMeta.get(id) ?? null;
    }

    const snapshotRes = await fetch(`${API_BASE}/data/sync-v${version}.json`, {
      // @ts-ignore
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!snapshotRes.ok) return null;

    const snapshot = (await snapshotRes.json()) as {
      data: { parishes: SnapshotParish[]; photos: SnapshotPhoto[] };
    };

    const photoByParish = new Map<number, string>();
    for (const ph of snapshot.data.photos) {
      if (ph.image_url && !photoByParish.has(ph.parish_id)) {
        photoByParish.set(ph.parish_id, ph.image_url);
      }
    }

    const meta = new Map<number, ParishMeta>();
    for (const p of snapshot.data.parishes) {
      meta.set(p.id, {
        name_zh: p.name_zh,
        address: p.address ?? null,
        photo: photoByParish.get(p.id) ?? null,
      });
    }

    cachedMeta = meta;
    cachedVersion = version;
    return meta.get(id) ?? null;
  } catch {
    return null;
  }
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const onRequest: PagesFunction = async (context) => {
  const { params, request } = context;
  const id = Number(params.id);

  const indexResponse = await context.next();
  if (!Number.isFinite(id)) return indexResponse;

  const parish = await getParishMeta(id);
  if (!parish) return indexResponse;

  const title = esc(`${parish.name_zh} - ${APP_NAME}`);
  const desc = esc(
    parish.address
      ? `${parish.name_zh}，位於 ${parish.address}。查看彌撒時間與聯絡資訊。`
      : `${parish.name_zh} 彌撒時間與聯絡資訊。`,
  );
  const image = esc(parish.photo ?? DEFAULT_OG_IMAGE);
  const url = esc(`${new URL(request.url).origin}/church/${id}`);

  const tags = `<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${image}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="place">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="${APP_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${image}">`;

  return new HTMLRewriter()
    .on('title', {
      element(el) { el.remove(); },
    })
    .on('head', {
      element(el) { el.prepend(tags, { html: true }); },
    })
    .transform(indexResponse);
};
