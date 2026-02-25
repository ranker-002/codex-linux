/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'codex-offline-v1';
const STATIC_CACHE = 'codex-static-v1';
const DYNAMIC_CACHE = 'codex-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

const API_CACHE_DURATION = 5 * 60 * 1000;

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const network = await fetch(request);
    if (network.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

export {};
