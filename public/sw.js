// Minimal service worker. Required for Chrome's "Install app" prompt.
// We deliberately don't cache anything (the app is auth-gated and tiny),
// so every request goes to the network and stays fresh.

self.addEventListener("install", () => {
  // Take control immediately on first install.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: let the browser handle the request normally.
});
