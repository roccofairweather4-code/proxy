"use strict";

/* ---------- Settings you can change ---------- */

// %s is replaced with the search terms.
const SEARCH_ENGINE = "https://duckduckgo.com/?q=%s";

/* ---------- Scramjet v2 setup ---------- */

const $ = (id) => document.getElementById(id);
const home = $("home");
const browser = $("browser");
const errorBox = $("error");
const barAddress = $("bar-address");

let controller = null;
let utils = null;
let frame = null;

function setStatus(text, state) {
	$("status").textContent = text;
	$("dot").className = "dot " + (state || "");
}

function loadScript(src) {
	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = src;
		script.onload = resolve;
		script.onerror = () => reject(new Error("Failed to load " + src));
		document.head.append(script);
	});
}

async function boot() {
	if (!("serviceWorker" in navigator)) {
		throw new Error("This browser doesn't support service workers.");
	}
	const local = ["localhost", "127.0.0.1"].includes(location.hostname);
	if (location.protocol !== "https:" && !local) {
		throw new Error("The proxy needs HTTPS (or localhost) to work.");
	}

	// 1. Service worker: must be active and controlling this page.
	const registration = await navigator.serviceWorker.register("/sw.js", {
		scope: "/",
		updateViaCache: "none",
	});
	await navigator.serviceWorker.ready;
	if (!navigator.serviceWorker.controller) {
		await new Promise((resolve) =>
			navigator.serviceWorker.addEventListener("controllerchange", resolve, {
				once: true,
			})
		);
	}
	const serviceworker = navigator.serviceWorker.controller ?? registration.active;
	if (!serviceworker) throw new Error("The service worker did not become active.");

	// 2. Scramjet runtime, controller and utilities (order matters).
	for (const src of [
		"/scram/scramjet.js",
		"/controller/controller.api.js",
		"/utils/scramjet-utils.js",
	]) {
		await loadScript(src);
	}
	utils = window.$scramjetUtils;

	// 3. Transport: libcurl over this server's Wisp endpoint.
	const { default: LibcurlClient } = await import("/libcurl/index.mjs");
	const scheme = location.protocol === "https:" ? "wss:" : "ws:";
	const transport = new LibcurlClient({
		wisp: `${scheme}//${location.host}/wisp/`,
	});

	// 4. Controller.
	controller = new window.$scramjetController.Controller({
		serviceworker,
		transport,
		config: {
			scramjetPath: "/scram/scramjet.js",
			wasmPath: "/scram/scramjet.wasm",
			injectPath: "/controller/controller.inject.js",
		},
	});
	await controller.wait();

	// Keeps an idle service worker from losing its routing state.
	setInterval(() => {
		navigator.serviceWorker.controller?.postMessage("keepalive");
	}, 15000);
}

const ready = boot().then(
	() => setStatus("Engines ready", "ready"),
	(err) => {
		setStatus("Engine failure", "failed");
		throw err;
	}
);
ready.catch(showError);

/* ---------- Navigation ---------- */

// Turns what the user typed into a URL: a real address or a search.
function toUrl(input) {
	input = input.trim();
	try {
		return new URL(input).toString();
	} catch {}
	if (/^[^\s]+\.[^\s]{2,}$/.test(input)) {
		try {
			return new URL("https://" + input).toString();
		} catch {}
	}
	return SEARCH_ENGINE.replace("%s", encodeURIComponent(input));
}

function showError(err) {
	errorBox.textContent = err && err.message ? err.message : String(err);
	errorBox.hidden = false;
}

async function go(input) {
	if (!input.trim()) return;
	errorBox.hidden = true;
	try {
		await ready;
	} catch (err) {
		return showError(err);
	}

	const url = toUrl(input);

	if (!frame) {
		const iframe = document.createElement("iframe");
		iframe.title = "Proxied page";
		iframe.addEventListener("load", () => browser.classList.add("loaded"));
		frame = controller.createFrame(iframe, {
			plugins: [
				new utils.HttpCachePlugin(),
				// Keeps the address bar in sync as the page navigates.
				new utils.UrlWatcherPlugin((current) => {
					if (current && document.activeElement !== barAddress) {
						barAddress.value = String(current);
					}
				}),
			],
		});
		// createFrame doesn't attach the iframe, so add it to the page here.
		$("viewport").appendChild(iframe);
	}

	browser.classList.remove("loaded");
	barAddress.value = url;
	home.hidden = true;
	browser.hidden = false;
	frame.go(url);
}

$("launch").addEventListener("submit", (e) => {
	e.preventDefault();
	go($("address").value);
});

$("bar-form").addEventListener("submit", (e) => {
	e.preventDefault();
	barAddress.blur();
	go(barAddress.value);
});

document.querySelectorAll("[data-url]").forEach((el) => {
	el.addEventListener("click", () => go(el.dataset.url));
});

$("back").addEventListener("click", () => frame && frame.back());
$("forward").addEventListener("click", () => frame && frame.forward());
$("reload").addEventListener("click", () => frame && frame.reload());
$("fullscreen").addEventListener("click", () => {
	if (document.fullscreenElement) document.exitFullscreen();
	else browser.requestFullscreen();
});
$("exit").addEventListener("click", () => {
	browser.hidden = true;
	home.hidden = false;
	$("address").value = "";
	$("address").focus();
});

/* ---------- Background: stars streaking past ---------- */

(function sky() {
	const canvas = $("sky");
	const ctx = canvas.getContext("2d");
	const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
	let w, h, stars;

	function reset() {
		w = canvas.width = innerWidth;
		h = canvas.height = innerHeight;
		stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
			x: Math.random() * w,
			y: Math.random() * h,
			z: Math.random() * 0.9 + 0.1,
		}));
	}

	function draw() {
		ctx.clearRect(0, 0, w, h);
		for (const s of stars) {
			const len = s.z * 26;
			ctx.strokeStyle = `rgba(255, ${170 + s.z * 60}, ${150 + s.z * 80}, ${s.z * 0.7})`;
			ctx.lineWidth = s.z * 1.4;
			ctx.beginPath();
			ctx.moveTo(s.x, s.y);
			ctx.lineTo(s.x + len, s.y - len * 0.35);
			ctx.stroke();
			if (!still) {
				s.x -= s.z * 3.2;
				s.y += s.z * 1.1;
				if (s.x < -40 || s.y > h + 20) {
					s.x = w + Math.random() * 40;
					s.y = Math.random() * h - 20;
				}
			}
		}
		// Pause the animation while a proxied page covers it.
		if (!still) requestAnimationFrame(draw);
	}

	addEventListener("resize", () => {
		reset();
		if (still) draw();
	});
	reset();
	draw();
})();
