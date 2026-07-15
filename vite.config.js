import { createReadStream } from "node:fs";
import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const LOCAL_ASSET_ROOT = "local-resources/original-video-assets";
const AUTO_MODEL_FOLDER = "model/vrm-samples";
const AUTO_MOTION_FOLDERS = ["motion/mixamo-vrma", "motion/vrma"];
const MODEL_EXTENSIONS = new Set([".pmx", ".pmd", ".vrm"]);
const MOTION_EXTENSIONS = new Set([".vrma"]);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";
const DEMO_PROFILE_PATH = "public/demo-profile.json";
const DEMO_CONFIG_DIR = "public/demo-configs";
const DEFAULT_DEMO_CONFIGURATION = "default";
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ASSET_URL_PREFIX = `/${LOCAL_ASSET_ROOT}/`;

const CONTENT_TYPES = new Map([
  [".bmp", "image/bmp"],
  [".fbx", "application/octet-stream"],
  [".flac", "audio/flac"],
  [".glb", "model/gltf-binary"],
  [".gltf", "model/gltf+json"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".json", "application/json; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".pmd", "application/octet-stream"],
  [".pmx", "application/octet-stream"],
  [".png", "image/png"],
  [".tga", "image/x-tga"],
  [".txt", "text/plain; charset=utf-8"],
  [".vmd", "application/octet-stream"],
  [".vpd", "application/octet-stream"],
  [".vrm", "model/gltf-binary"],
  [".vrma", "model/gltf-binary"],
  [".wav", "audio/wav"],
  [".webp", "image/webp"]
]);

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function getRequestPathname(request) {
  try {
    return new URL(request.url || "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function isExactRequestPath(request, pathname) {
  return getRequestPathname(request) === pathname;
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

async function serveLocalAsset(rootDir, request, response, next) {
  const pathname = getRequestPathname(request);
  if (!pathname.startsWith(LOCAL_ASSET_URL_PREFIX)) {
    next();
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    response.end("Method Not Allowed");
    return;
  }

  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    response.statusCode = 400;
    response.end("Bad Request");
    return;
  }

  const localAssetRoot = path.resolve(rootDir, LOCAL_ASSET_ROOT);
  const filePath = path.resolve(rootDir, decodedPathname.slice(1));
  if (filePath !== localAssetRoot && !filePath.startsWith(`${localAssetRoot}${path.sep}`)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }

  if (!fileStat.isFile()) {
    response.statusCode = 404;
    response.end("Not Found");
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", getContentType(filePath));
  response.setHeader("Content-Length", String(fileStat.size));
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).on("error", () => {
    if (!response.headersSent) {
      response.statusCode = 500;
    }
    response.end();
  }).pipe(response);
}

async function findFirstModelFile(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && MODEL_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (files.length > 0) {
    return path.join(folder, files[0]);
  }

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const child of folders) {
    const found = await findFirstModelFile(path.join(folder, child));
    if (found) {
      return found;
    }
  }

  return null;
}

async function discoverModelPresets(rootDir) {
  const assetRoot = path.join(rootDir, LOCAL_ASSET_ROOT);
  const modelRoot = path.join(assetRoot, AUTO_MODEL_FOLDER);

  try {
    await access(modelRoot);
  } catch {
    return [];
  }

  const folders = (await readdir(modelRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const presets = await Promise.all(
    folders.map(async (folderName, index) => {
      const modelFile = await findFirstModelFile(path.join(modelRoot, folderName));
      if (!modelFile) {
        return null;
      }

      const relativePath = toPosixPath(path.relative(assetRoot, modelFile));
      const id = `vrm-sample-${slugify(folderName) || index + 1}`;
      const kind = path.extname(modelFile).slice(1).toLowerCase();

      return {
        id,
        label: folderName,
        path: relativePath,
        kind,
        required: false,
        sourceId: "madjin-vrm-samples"
      };
    })
  );

  return presets.filter(Boolean);
}

function formatMotionLabel(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function findMotionFiles(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  const sortedEntries = entries
    .filter((entry) => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of sortedEntries) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findMotionFiles(fullPath));
      continue;
    }
    if (entry.isFile() && MOTION_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function discoverMotionPresets(rootDir) {
  const assetRoot = path.join(rootDir, LOCAL_ASSET_ROOT);
  const discovered = [];

  for (const folder of AUTO_MOTION_FOLDERS) {
    const motionRoot = path.join(assetRoot, folder);
    const sourceId = folder.includes("mixamo") ? "mixamo-vrma-local" : "local-vrma-folder";
    const files = await findMotionFiles(motionRoot);

    files.forEach((filePath, index) => {
      const relativePath = toPosixPath(path.relative(assetRoot, filePath));
      const relativeInFolder = toPosixPath(path.relative(motionRoot, filePath));
      const idBase = slugify(relativeInFolder.replace(/\.[^.]+$/, "")) || String(index + 1);

      discovered.push({
        id: `${sourceId}-${idBase}`,
        label: formatMotionLabel(filePath),
        path: relativePath,
        kind: "vrma",
        required: false,
        sourceId
      });
    });
  }

  return discovered;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be JSON"));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function getOllamaErrorMessage(error, model) {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(message)) {
    return `Ollama is not running. Start Ollama and pull ${model}.`;
  }
  if (/model.*not found|not found/i.test(message)) {
    return `Model ${model} is not installed. Run: ollama pull ${model}`;
  }
  return message || "Ollama request failed";
}

async function handleOllamaChat(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "POST required" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const model = body.model || DEFAULT_OLLAMA_MODEL;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let ollamaResponse;

    try {
      ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 90
          }
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await ollamaResponse.json().catch(() => ({}));
    if (!ollamaResponse.ok) {
      sendJson(response, ollamaResponse.status, {
        error: getOllamaErrorMessage(new Error(payload.error || ollamaResponse.statusText), model)
      });
      return;
    }

    sendJson(response, 200, {
      model: payload.model || model,
      message: payload.message?.content || ""
    });
  } catch (error) {
    sendJson(response, 503, {
      error: getOllamaErrorMessage(error, DEFAULT_OLLAMA_MODEL)
    });
  }
}

async function handleDemoProfileSave(rootDir, request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "POST required" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    if (!body?.modelPresetAsset?.path) {
      sendJson(response, 400, { error: "Demo profile requires a selected model asset" });
      return;
    }

    const configuration = slugify(String(body.configuration || DEFAULT_DEMO_CONFIGURATION)) ||
      DEFAULT_DEMO_CONFIGURATION;
    const namedPath = path.join(DEMO_CONFIG_DIR, `${configuration}.json`);
    const outputPath = path.join(rootDir, namedPath);
    const defaultPath = path.join(rootDir, DEMO_PROFILE_PATH);
    const profile = {
      ...body,
      configuration
    };

    await mkdir(path.dirname(outputPath), { recursive: true });
    await mkdir(path.dirname(defaultPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    await writeFile(defaultPath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
    sendJson(response, 200, {
      ok: true,
      path: namedPath,
      defaultPath: DEMO_PROFILE_PATH,
      configuration,
      modelPreset: body.modelPreset || ""
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Demo profile save failed"
    });
  }
}

function localModelPresetPlugin() {
  return {
    name: "local-companion-dev-services",
    configureServer(server) {
      server.middlewares.use("/local-model-presets.json", async (_request, response) => {
        try {
          const modelPresets = await discoverModelPresets(server.config.root);
          sendJson(response, 200, { modelPresets });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Model discovery failed",
            modelPresets: []
          });
        }
      });
      server.middlewares.use("/local-motion-presets.json", async (_request, response) => {
        try {
          const motionPresets = await discoverMotionPresets(server.config.root);
          sendJson(response, 200, { motionPresets });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Motion discovery failed",
            motionPresets: []
          });
        }
      });
      server.middlewares.use("/ollama-chat", handleOllamaChat);
      server.middlewares.use((request, response, next) => {
        if (!isExactRequestPath(request, "/demo-profile")) {
          next();
          return;
        }
        handleDemoProfileSave(server.config.root, request, response);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        serveLocalAsset(process.cwd(), request, response, next).catch((error) => {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Local asset serving failed"
          });
        });
      });
      server.middlewares.use("/local-model-presets.json", async (_request, response) => {
        try {
          const modelPresets = await discoverModelPresets(process.cwd());
          sendJson(response, 200, { modelPresets });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Model discovery failed",
            modelPresets: []
          });
        }
      });
      server.middlewares.use("/local-motion-presets.json", async (_request, response) => {
        try {
          const motionPresets = await discoverMotionPresets(process.cwd());
          sendJson(response, 200, { motionPresets });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Motion discovery failed",
            motionPresets: []
          });
        }
      });
      server.middlewares.use("/ollama-chat", handleOllamaChat);
      server.middlewares.use((request, response, next) => {
        if (!isExactRequestPath(request, "/demo-profile")) {
          next();
          return;
        }
        handleDemoProfileSave(process.cwd(), request, response);
      });
    }
  };
}

export default defineConfig({
  base: process.env.SOULECHO_BASE_PATH || "/",
  build: {
    rollupOptions: {
      input: {
        admin: path.resolve(PROJECT_ROOT, "index.html"),
        demo: path.resolve(PROJECT_ROOT, "demo.html")
      }
    }
  },
  plugins: [localModelPresetPlugin()]
});
