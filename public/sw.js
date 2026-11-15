importScripts("/controller/controller.sw.js");

// Some sites (Discord's homepage included) lock their stylesheets with an
// "integrity" hash. Scramjet rewrites those files, the hash stops matching,
// and the browser throws the styles away. Stripping the attribute fixes it.
const INTEGRITY = /\sintegrity\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

async function stripIntegrity(responsePromise) {
	const response = await responsePromise;
	const type = response.headers.get("content-type") || "";
	if (!type.includes("text/html") || !response.ok) return response;

	const html = await response.text();
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	return new Response(html.replace(INTEGRITY, ""), {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

self.addEventListener("fetch", (event) => {
	// shouldRoute keeps the worker from intercepting its own runtime files.
	if ($scramjetController.shouldRoute(event)) {
		event.respondWith(stripIntegrity($scramjetController.route(event)));
	}
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
	event.waitUntil(self.clients.claim())
);
