import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "vite";

const LOCAL_ASSET_ROOT = "local-resources/original-video-assets";
const AUTO_MODEL_FOLDER = "model/vrm-samples";
const MODEL_EXTENSIONS = new Set([".pmx", ".pmd", ".vrm"]);
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

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
      server.middlewares.use("/ollama-chat", handleOllamaChat);
    },
    configurePreviewServer(server) {
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
      server.middlewares.use("/ollama-chat", handleOllamaChat);
    }
  };
}

export default defineConfig({
  plugins: [localModelPresetPlugin()]
});
