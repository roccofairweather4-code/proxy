import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";

// Scramjet v2's helper packages have no path export, so find their folders.
const require = createRequire(import.meta.url);
const dirOf = (name) => dirname(require.resolve(name));
const controllerPath = dirOf("@mercuryworkshop/scramjet-controller");
const utilsPath = dirOf("@mercuryworkshop/scramjet-utils");
const libcurlPath = dirOf("@mercuryworkshop/libcurl-transport");

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

/* ---------- Access code ---------- */

// Visitors must type this code before they can use the site.
// Set the ACCESS_CODE environment variable on your host to change it.
const ACCESS_CODE = process.env.ACCESS_CODE || "onlylennyandted";

const COOKIE = "mach5_key";
const hash = (text) => createHash("sha256").update(text).digest();
const keyHex = hash("mach5:" + ACCESS_CODE).toString("hex");

// Pages and files someone can load before entering the code.
const OPEN_PATHS = new Set(["/lock.html", "/style.css", "/favicon.svg"]);

function isUnlocked(req) {
	const cookies = req.headers.cookie || "";
	return cookies
		.split(";")
		.some((part) => part.trim() === `${COOKIE}=${keyHex}`);
}

function handleUnlock(req, res) {
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
		if (body.length > 1000) req.destroy();
	});
	req.on("end", () => {
		let code = "";
		try {
			code = String(JSON.parse(body).code || "");
		} catch {}
		const ok = timingSafeEqual(hash(code), hash(ACCESS_CODE));
		if (ok) {
			res.setHeader(
				"Set-Cookie",
				`${COOKIE}=${keyHex}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
			);
		}
		res.writeHead(ok ? 200 : 401, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok }));
	});
}

/* ---------- Proxy ---------- */

// Wisp carries the proxied traffic over a websocket.
logging.set_level(logging.NONE);

const fastify = Fastify({
	serverFactory: (handler) =>
		createServer()
			.on("request", (req, res) => {
				// Required so Scramjet can use SharedArrayBuffer.
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

				const path = req.url.split("?")[0];
				if (req.method === "POST" && path === "/unlock") {
					return handleUnlock(req, res);
				}
				if (!isUnlocked(req) && !OPEN_PATHS.has(path)) {
					res.writeHead(302, { Location: "/lock.html", "Cache-Control": "no-store" });
					return res.end();
				}
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				const path = new URL(req.url ?? "/", "http://localhost").pathname;
				if (isUnlocked(req) && path === "/wisp/") {
					req.url = path;
					wisp.routeRequest(req, socket, head);
				} else socket.end();
			}),
});

fastify.register(fastifyStatic, { root: publicPath, decorateReply: true });
fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: controllerPath,
	prefix: "/controller/",
	decorateReply: false,
});
fastify.register(fastifyStatic, {
	root: utilsPath,
	prefix: "/utils/",
	decorateReply: false,
});

fastify.setNotFoundHandler((req, reply) =>
	reply.code(404).type("text/html").sendFile("404.html")
);

const port = parseInt(process.env.PORT || "") || 8080;

fastify.server.on("listening", () => {
	console.log("Mach 5 is running:");
	console.log(`  http://localhost:${port}`);
	console.log(`  http://${hostname()}:${port}`);
});

function shutdown() {
	console.log("Shutting down");
	fastify.close();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

fastify.listen({ port, host: "0.0.0.0" });
