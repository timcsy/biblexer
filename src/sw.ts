/// <reference lib="webworker" />
// Service Worker（research R7）：預先快取 app shell；/data、/models、/ort 一律先查 Cache Storage（由頁面下載填入）。
import { BASE } from './base.ts';
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

void self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// 部署在子路徑時，資源在 BASE 之下（如 /biblexer/data/）
const ASSETS = new RegExp(`^${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(data|models|ort)/`);
const OFFLINE_HEADER = 'x-biblexer-offline';
registerRoute(
  ({ url }) => url.origin === self.location.origin && ASSETS.test(url.pathname),
  async ({ request, url }) => {
    // manifest 要能偵測更新：先走網路，失敗才用快取
    if (url.pathname === `${BASE}data/manifest.json`) {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match(request.url);
        if (!cached) return Response.error();
        // 標示這是離線時由快取提供，讓頁面知道現在無法下載
        const headers = new Headers(cached.headers);
        headers.set(OFFLINE_HEADER, '1');
        return new Response(cached.body, { status: cached.status, headers });
      }
    }
    return (await caches.match(request.url)) ?? fetch(request);
  },
);
