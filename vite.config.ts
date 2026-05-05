import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const presetsFilePath = resolve(configDirectory, "data/presets.json");

const defaultPresetPayload = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  presets: [],
};

const isPresetLike = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.noise === "object" &&
    typeof candidate.gradient === "object"
  );
};

const normalizePresetPayload = (value: unknown) => {
  const source =
    Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray((value as { presets?: unknown[] }).presets)
        ? (value as { presets: unknown[] }).presets
        : [];

  return source
    .filter(isPresetLike)
    .map((preset) => {
      const { thumbnail: _thumbnail, ...rest } = preset as Record<string, unknown>;
      return rest;
    });
};

const ensurePresetsFile = async () => {
  await mkdir(dirname(presetsFilePath), { recursive: true });

  if (!existsSync(presetsFilePath)) {
    await writeFile(
      presetsFilePath,
      `${JSON.stringify(defaultPresetPayload, null, 2)}\n`,
      "utf8",
    );
  }
};

const readPresetPayload = async () => {
  await ensurePresetsFile();

  try {
    const raw = await readFile(presetsFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version:
        parsed && typeof parsed === "object" && typeof parsed.version === "number"
          ? parsed.version
          : 1,
      updatedAt:
        parsed && typeof parsed === "object" && typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      presets: normalizePresetPayload(parsed),
    };
  } catch {
    return { ...defaultPresetPayload, updatedAt: new Date().toISOString() };
  }
};

const writePresetPayload = async (value: unknown) => {
  const presets = normalizePresetPayload(value);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    presets,
  };

  await ensurePresetsFile();
  await writeFile(
    presetsFilePath,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  return payload;
};

const readRequestBody = async (request: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const attachPresetApi = (
  middlewares: { use: (handler: (req: any, res: any, next: () => void) => void | Promise<void>) => void },
) => {
  middlewares.use(async (request, response, next) => {
    const requestUrl = request.url?.split("?")[0];
    if (requestUrl !== "/api/presets") {
      next();
      return;
    }

    if (request.method === "GET") {
      const payload = await readPresetPayload();
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(payload));
      return;
    }

    if (request.method === "POST") {
      try {
        const body = await readRequestBody(request);
        const parsed = JSON.parse(body);
        const payload = await writePresetPayload(parsed);
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(payload));
      } catch (error) {
        response.statusCode = 400;
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Invalid preset payload.",
          }),
        );
      }
      return;
    }

    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ error: "Method not allowed." }));
  });
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: "repo-preset-sync",
      configureServer(server) {
        attachPresetApi(server.middlewares);
      },
      configurePreviewServer(server) {
        attachPresetApi(server.middlewares);
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
