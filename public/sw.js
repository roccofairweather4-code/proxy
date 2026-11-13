importScripts("/controller/controller.sw.js");

self.addEventListener("fetch", (event) => {
	// shouldRoute keeps the worker from intercepting its own runtime files.
	if ($scramjetController.shouldRoute(event)) {
		event.respondWith($scramjetController.route(event));
	}
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
	event.waitUntil(self.clients.claim())
);
