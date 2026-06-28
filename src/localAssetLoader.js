const DEFAULT_CONFIG_URL = "/local-resources/original-video-assets/config.json";
const FALLBACK_CONFIG_URL = "/resources/original-video-assets/config.example.json";

const ASSET_ORDER = ["model", "stage", "motion", "camera", "facial", "audio"];

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinUrl(root, path) {
  if (!path) {
    return "";
  }
  if (/^(https?:|file:|blob:|data:)/i.test(path)) {
    return path;
  }
  return `${root.replace(/\/?$/, "/")}${trimSlashes(path)}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Config returned ${response.status}`);
  }
  return response.json();
}

async function probeAsset(url) {
  if (!url) {
    return { ok: false, status: 0, bytes: 0 };
  }

  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) {
      return {
        ok: true,
        status: head.status,
        bytes: Number(head.headers.get("content-length") || 0)
      };
    }
  } catch {
    // Some local/WebKit file bridges do not support HEAD. Try a tiny GET.
  }

  try {
    const get = await fetch(url, {
      cache: "no-store",
      headers: { Range: "bytes=0-0" }
    });
    return {
      ok: get.ok || get.status === 206,
      status: get.status,
      bytes: Number(get.headers.get("content-length") || 0)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      bytes: 0,
      error: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
}

function pickScene(config) {
  const scenes = Array.isArray(config.scenes) ? config.scenes : [];
  return scenes.find((scene) => scene.id === config.activeScene) || scenes[0] || null;
}

function normalizeAssets(config, scene) {
  const root = config.assetRoot || "/local-resources/original-video-assets/";
  const assets = scene?.assets || {};

  return ASSET_ORDER.map((name) => {
    const entry = assets[name];
    const normalized = typeof entry === "string" ? { path: entry } : entry || {};
    return {
      name,
      kind: normalized.kind || name,
      path: normalized.path || "",
      url: joinUrl(root, normalized.path || ""),
      required: Boolean(normalized.required)
    };
  });
}

function summarize(results) {
  const configured = results.filter((item) => item.path);
  const found = configured.filter((item) => item.ok);
  const requiredMissing = configured.filter((item) => item.required && !item.ok);

  if (configured.length === 0) {
    return "No local assets configured";
  }
  if (requiredMissing.length > 0) {
    return `${found.length}/${configured.length} local assets found`;
  }
  return `${found.length}/${configured.length} local assets ready`;
}

export async function loadLocalAssetConfig(configUrl = DEFAULT_CONFIG_URL) {
  let configSource = configUrl;
  let usingExample = false;
  let config;

  try {
    config = await fetchJson(configUrl);
  } catch (error) {
    config = await fetchJson(FALLBACK_CONFIG_URL);
    configSource = FALLBACK_CONFIG_URL;
    usingExample = true;
  }

  const scene = pickScene(config);
  const assets = normalizeAssets(config, scene);
  const results = await Promise.all(
    assets.map(async (asset) => {
      const probe = await probeAsset(asset.url);
      return { ...asset, ...probe };
    })
  );

  return {
    config,
    configSource,
    usingExample,
    scene,
    assets: results,
    summary: summarize(results)
  };
}

export function renderAssetStatus(state, target) {
  if (!target) {
    return;
  }

  const found = state.assets.filter((asset) => asset.path && asset.ok).length;
  const configured = state.assets.filter((asset) => asset.path).length;
  const missingRequired = state.assets.filter(
    (asset) => asset.path && asset.required && !asset.ok
  );
  const mode = state.usingExample ? "Template" : "Local";

  target.dataset.state = missingRequired.length > 0 ? "warning" : "ready";
  target.innerHTML = `
    <span>${mode} assets</span>
    <strong>${found}/${configured}</strong>
    <small>${state.summary}</small>
  `;
}
