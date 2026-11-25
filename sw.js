/* 2026 알바 실수령액 계산기 — 오프라인 지원 서비스 워커
   · 페이지(문서)는 항상 네트워크 우선 → 최신 내용을 보여주고, 끊겼을 때만 캐시로 대체
   · 아이콘·매니페스트 같은 정적 파일은 캐시 우선 + 뒤에서 조용히 갱신
   · 캐시 버전(VERSION)을 올리면 예전 캐시는 활성화 때 자동 삭제됩니다. */
const VERSION = "alba-calc-v2";
const CACHE = VERSION;
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch (err) {
        /* 한 파일이 실패해도 설치 자체는 진행 (오프라인 목록에서만 빠짐) */
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("alba-calc-") && k !== CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scopePath = new URL("./", self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = (await cache.match(req)) || (await cache.match("./index.html"));
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>오프라인</title><body style='font-family:system-ui;padding:32px;line-height:1.6'>" +
      "<h1 style='font-size:20px'>인터넷이 끊겨 있어요</h1>" +
      "<p style='color:#6B7684'>연결된 뒤 다시 열어 주세요.</p></body>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) return cached;

  const res = await network;
  if (res) return res;
  return new Response("", { status: 504, statusText: "offline" });
}
