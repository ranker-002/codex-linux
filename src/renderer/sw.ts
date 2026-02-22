/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'codex-linux-v1';
const RUNTIME_CACHE = 'codex-runtime';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

function getCacheStrategy(url: string): string {
  if (url.includes('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  if (url.includes('/static/') || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.woff2')) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
}

async function cacheFirst(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      caches.open(RUNTIME_CACHE).then(cache => {
        cache.put(request, networkResponse.clone());
      });
    }
    return networkResponse;
  }).catch((): Promise<Response> => {
    if (cachedResponse) {
      return Promise.resolve(cachedResponse);
    }
    return Promise.reject(new Error('No response available'));
  });
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  return fetchPromise;
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') {
    return;
  }
  
  const url = new URL(event.request.url);
  
  if (url.origin !== self.location.origin) {
    return;
  }
  
  const strategy = getCacheStrategy(event.request.url);
  
  let response: Promise<Response>;
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      response = cacheFirst(event.request);
      break;
    case CACHE_STRATEGIES.NETWORK_FIRST:
      response = networkFirst(event.request);
      break;
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      response = staleWhileRevalidate(event.request);
      break;
    default:
      response = fetch(event.request);
  }
  
  event.respondWith(response);
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type: string; urls?: string[] };
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (data && data.type === 'CACHE_URLS') {
    const { urls } = data;
    if (urls) {
      caches.open(RUNTIME_CACHE).then(cache => {
        cache.addAll(urls);
      });
    }
  }
  
  if (data && data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      Promise.all(cacheNames.map(name => caches.delete(name)));
    });
  }
});

export {};
