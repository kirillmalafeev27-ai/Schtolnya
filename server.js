// Сервер из See Escape: статика сборки, gzip/brotli, /healthz и маршруты квиза
// (quiz-generation.cjs). Кооп-комнаты корабля See Escape сюда не перенесены — в «Шахте» их нет.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { installQuizRoutes } = require("./quiz-generation.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Vite собирает игру в dist/ (npm run build).
const publicDir = path.join(__dirname, "dist");
// Container hosts disagree about which port they route to, and some (Northflank
// among them) do not inject $PORT at all. Accept a comma-separated list, and
// with nothing configured serve both common defaults so the platform's port
// entry matches whatever it was set to.
const DEFAULT_PORTS = [8080, 3000];
const PORTS = resolvePorts();

function resolvePorts() {
  const raw = process.env.PORTS || process.env.PORT || "";
  const ports = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);
  return ports.length ? [...new Set(ports)] : [...DEFAULT_PORTS];
}
const HOST = process.env.HOST || "0.0.0.0";
const JSON_LIMIT = 1024 * 1024;

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".glb", "model/gltf-binary"],
  [".gltf", "model/gltf+json"],
  [".bin", "application/octet-stream"],
]);
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg"]);
const LARGE_ASSET = new Set([".glb", ".gltf", ".bin", ".jpg", ".jpeg", ".png", ".webp", ".woff", ".woff2"]);

// Сжатое тело файла считается один раз и живёт в памяти. Бандл игры — один файл на 1,6 МБ,
// а brotli с качеством по умолчанию (11) сжимал его заново на каждый запрос: 3 с на быстром
// ядре и десятки секунд на маленьком инстансе Northflank — всё это время страница пустая.
// Качество 5 сжимает тот же бандл за десятки миллисекунд и почти так же плотно, как gzip -9.
const BROTLI_OPTIONS = { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } };
const compressedCache = new Map();

function compressedBody(filePath, stat, encoding) {
  const key = `${encoding}:${filePath}`;
  const cached = compressedCache.get(key);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.body;
  const body = fs.promises.readFile(filePath).then(
    (raw) =>
      new Promise((resolve, reject) => {
        const done = (error, out) => (error ? reject(error) : resolve(out));
        if (encoding === "br") zlib.brotliCompress(raw, BROTLI_OPTIONS, done);
        else zlib.gzip(raw, done);
      })
  );
  compressedCache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, body });
  body.catch(() => compressedCache.delete(key));
  return body;
}

/** Сжать всю сборку заранее, чтобы и первый игрок после деплоя не ждал. */
function warmCompressedCache(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      warmCompressedCache(filePath);
      continue;
    }
    if (!COMPRESSIBLE.has(path.extname(entry.name).toLowerCase())) continue;
    const stat = fs.statSync(filePath);
    for (const encoding of ["br", "gzip"]) compressedBody(filePath, stat, encoding).catch(() => {});
  }
}

function send(res, status, body, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, headers);
  res.end(body);
}

function decorateResponse(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    const payload = JSON.stringify(body);
    send(res, res.statusCode || 200, payload, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(payload),
      "Cache-Control": "no-cache",
    });
  };
  // getHeaders() already returns a plain header object. Object.fromEntries()
  // needs an iterable of pairs, so wrapping it threw "object is not iterable"
  // and every res.send() — the whole /api/tts route — answered 500.
  res.send = (body) => {
    if (Buffer.isBuffer(body)) {
      if (!res.getHeader("Content-Length")) res.setHeader("Content-Length", body.length);
      if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/octet-stream");
      send(res, res.statusCode || 200, body, res.getHeaders());
      return;
    }
    const payload = String(body ?? "");
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(payload));
    send(res, res.statusCode || 200, payload, res.getHeaders());
  };
}

function createRouteApp() {
  const routes = [];
  return {
    routes,
    get(routePath, handler) {
      routes.push({ method: "GET", routePath, handler });
    },
    post(routePath, handler) {
      routes.push({ method: "POST", routePath, handler });
    },
  };
}

const routeApp = createRouteApp();
installQuizRoutes(routeApp);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > JSON_LIMIT) {
        reject(Object.assign(new Error("request body too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(Object.assign(error, { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

async function dispatchRoute(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const route = routeApp.routes.find((item) => item.method === req.method && item.routePath === url.pathname);
  if (!route) return false;

  decorateResponse(res);
  req.query = Object.fromEntries(url.searchParams.entries());
  req.body = req.method === "POST" ? await readJsonBody(req) : {};

  try {
    await route.handler(req, res);
  } catch (error) {
    console.error("API route failed:", error);
    if (!res.writableEnded) {
      res.status(error.statusCode || 500).json({ error: error.message || "Internal server error" });
    }
  }
  return true;
}

function safePublicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = decoded === "/" ? "/index.html" : decoded;
  const candidate = path.normalize(path.join(publicDir, clean));
  return candidate.startsWith(publicDir) ? candidate : null;
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      const fallback = path.join(publicDir, "index.html");
      if (filePath === fallback) {
        // Без сборки отдавать нечего: сервер жив, но dist/ пуст.
        send(res, 503, "Build output missing: run `npm run build` first.", {
          "Content-Type": "text/plain; charset=utf-8",
        });
        return;
      }
      serveFile(req, res, fallback);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const cacheControl = ext === ".html"
      ? "no-cache"
      : (req.url || "").includes("?v=") || LARGE_ASSET.has(ext) || (req.url || "").startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";
    const headers = {
      "Content-Type": MIME.get(ext) || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": cacheControl,
      "Accept-Ranges": "bytes",
    };

    const range = req.headers.range;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const [startRaw, endRaw] = range.replace("bytes=", "").split("-");
      const start = startRaw === "" ? Math.max(0, stat.size - Number(endRaw || 0)) : Number(startRaw);
      const end = endRaw === "" ? stat.size - 1 : Math.min(stat.size - 1, Number(endRaw));
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stat.size) {
        res.writeHead(206, {
          ...headers,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        });
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    if (req.method === "HEAD") {
      send(res, 200, "", headers);
      return;
    }

    const accepts = String(req.headers["accept-encoding"] || "");
    const encoding = !COMPRESSIBLE.has(ext)
      ? ""
      : /\bbr\b/.test(accepts)
        ? "br"
        : /\bgzip\b/.test(accepts)
          ? "gzip"
          : "";
    if (encoding) {
      compressedBody(filePath, stat, encoding).then(
        (body) => {
          send(res, 200, body, {
            ...headers,
            "Content-Encoding": encoding,
            "Content-Length": body.length,
            Vary: "Accept-Encoding",
          });
        },
        () => {
          if (res.headersSent) res.destroy();
          else send(res, 500, "Internal server error");
        }
      );
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.writeHead(200, headers);
    stream.pipe(res);
    stream.on("error", () => {
      if (!res.headersSent) send(res, 500, "Internal server error");
      else res.destroy();
    });
  });
}

const requestHandler = async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);

  try {
    if (await dispatchRoute(req, res)) return;
  } catch (error) {
    send(res, error.statusCode || 500, JSON.stringify({ error: error.message || "Bad request" }), {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });
    return;
  }

  const filePath = safePublicPath(req.url || "/");
  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }

  serveFile(req, res, filePath);
};

console.log(
  `Port config: PORT=${process.env.PORT ?? "(unset)"} PORTS=${process.env.PORTS ?? "(unset)"} -> binding ${PORTS.join(", ")}`
);
if (!fs.existsSync(path.join(publicDir, "index.html"))) {
  console.warn("dist/index.html is missing — run `npm run build` before `npm start`.");
}
warmCompressedCache(publicDir);

PORTS.forEach((port, index) => {
  const server = http.createServer(requestHandler);
  server.on("error", (error) => {
    const reason = `Failed to bind ${HOST}:${port} — ${error.code || error.message}`;
    // The first port is the contract; the extras are best-effort convenience.
    if (index === 0) {
      console.error(reason);
      process.exit(1);
    }
    console.warn(`${reason} (extra port, ignored)`);
  });
  server.listen(port, HOST, () => {
    console.log(`Schtolnya listening on http://${HOST}:${port}`);
  });
});
