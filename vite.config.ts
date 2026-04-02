import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { createClientesDevMiddleware } from "./api/clientes/_clientes-api.ts";
import { createCotizacionesDevMiddleware } from "./api/cotizaciones/_cotizaciones-api.ts";
import { createDashboardDevMiddleware } from "./api/dashboard/_dashboard-api.ts";
import { createProspectosDevMiddleware } from "./api/prospectos/_prospectos-api.ts";
import { createVisitasDevMiddleware } from "./api/visitas/_visitas-api.ts";
import { createSeguimientosDevMiddleware } from "./api/seguimientos/_seguimientos-api.ts";
import {
  createAuthDevMiddleware,
  createProtectedApiDevMiddleware,
} from "./server/auth-api.ts";
import { createSertecDevMiddleware } from "./server/sertec-api.ts";
import { createContableTercerosDevMiddleware } from "./server/contable-terceros-api.ts";
import { createFacturasCompraDevMiddleware } from "./server/contable-facturas-compra-api.ts";
import { createContableNotasCreditoDevMiddleware } from "./server/contable-notas-credito-api.ts";
import { createContableCuadresCajaDevMiddleware } from "./server/contable-cuadres-caja-api.ts";
import { createContableNominaDevMiddleware } from "./server/contable-nomina-api.ts";
import { createEgresosDevMiddleware } from "./server/contable-egresos-api.ts";
import { createCarteraDevMiddleware } from "./server/contable-cartera-api.ts";
import { createRecibosCajaDevMiddleware } from "./server/contable-recibos-caja-api.ts";
import { createContableBancosDevMiddleware } from "./server/contable-bancos-api.ts";
import { createContableViaticosDevMiddleware } from "./server/contable-viaticos-api.ts";
import { createContableArchivoDevMiddleware } from "./server/contable-archivo-api.ts";
import { createContableReportesDevMiddleware } from "./server/contable-reportes-api.ts";
import { createUsersDevMiddleware } from "./server/users-api.ts";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  const lines = entries.map(entry => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }

      const htmlWithoutDevAnalytics = html.replace(
        /\s*<script[^>]*src="%VITE_ANALYTICS_ENDPOINT%\/umami"[^>]*data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"[^>]*><\/script>/i,
        ""
      );

      return {
        html: htmlWithoutDevAnalytics,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use(createAuthDevMiddleware());
      server.middlewares.use(createProtectedApiDevMiddleware());
      server.middlewares.use(createDashboardDevMiddleware());
      server.middlewares.use(createClientesDevMiddleware());
      server.middlewares.use(createCotizacionesDevMiddleware());
      server.middlewares.use(createVisitasDevMiddleware());
      server.middlewares.use(createSeguimientosDevMiddleware());
      server.middlewares.use(createProspectosDevMiddleware());
      server.middlewares.use(createSertecDevMiddleware());
      server.middlewares.use(createContableTercerosDevMiddleware());
      server.middlewares.use(createFacturasCompraDevMiddleware());
      server.middlewares.use(createContableNotasCreditoDevMiddleware());
      server.middlewares.use(createContableCuadresCajaDevMiddleware());
      server.middlewares.use(createContableNominaDevMiddleware());
      server.middlewares.use(createEgresosDevMiddleware());
      server.middlewares.use(createCarteraDevMiddleware());
      server.middlewares.use(createRecibosCajaDevMiddleware());
      server.middlewares.use(createContableBancosDevMiddleware());
      server.middlewares.use(createContableViaticosDevMiddleware());
      server.middlewares.use(createContableArchivoDevMiddleware());
      server.middlewares.use(createContableReportesDevMiddleware());
      server.middlewares.use(createUsersDevMiddleware());

      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

const plugins = [
  react(),
  tailwindcss(),
  vitePluginManusRuntime(),
  vitePluginManusDebugCollector(),
];

export default defineConfig(({ mode }) => {
  const projectRoot = path.resolve(import.meta.dirname);
  const localEnv = loadEnv(mode, projectRoot, "");

  // The Node middleware used in local Vite dev reads process.env, not import.meta.env.
  for (const [key, value] of Object.entries(localEnv)) {
    if (!value || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    envDir: projectRoot,
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      strictPort: true,
      host: true,
      allowedHosts: [
        ".manuspre.computer",
        ".manus.computer",
        ".manus-asia.computer",
        ".manuscomputer.ai",
        ".manusvm.computer",
        "localhost",
        "127.0.0.1",
      ],
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port: 3000,
      strictPort: true,
      host: true,
    },
  };
});
