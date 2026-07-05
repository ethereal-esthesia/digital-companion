const DEFAULT_CONFIG_URL = "/local-resources/original-video-assets/config.json";
const FALLBACK_CONFIG_URL = "/resources/original-video-assets/config.example.json";
const DISCOVERED_MODEL_PRESETS_URL = "/local-model-presets.json";

const ASSET_ORDER = ["model", "stage", "motion", "camera", "facial", "audio"];
const MODEL_PRESET_QUERY_KEY = "modelPreset";

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

function expectsBinaryAsset(url) {
  return /\.(pmx|pmd|vrm|vrma|vmd|vpd|mp3|wav|ogg|flac|zip|unitypackage|fbx|blend|png|jpe?g|bmp|tga)(?:[?#]|$)/i.test(url);
}

function isHtmlFallback(url, response) {
  return expectsBinaryAsset(url) && response.headers.get("content-type")?.includes("text/html");
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Config returned ${response.status}`);
  }
  return response.json();
}

async function fetchDiscoveredModelPresets() {
  try {
    const discovered = await fetchJson(DISCOVERED_MODEL_PRESETS_URL);
    return Array.isArray(discovered.modelPresets) ? discovered.modelPresets : [];
  } catch {
    return [];
  }
}

async function probeAsset(url) {
  if (!url) {
    return { ok: false, status: 0, bytes: 0 };
  }

  try {
    const head = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) {
      return {
        ok: !isHtmlFallback(url, head),
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
      ok: (get.ok || get.status === 206) && !isHtmlFallback(url, get),
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

function normalizeAssetEntry(name, entry, root) {
  const normalized = typeof entry === "string" ? { path: entry } : entry || {};

  return {
    name,
    kind: normalized.kind || name,
    path: normalized.path || "",
    url: joinUrl(root, normalized.path || ""),
    required: Boolean(normalized.required),
    label: normalized.label || normalized.name || name
  };
}

function normalizeModelPresets(scene, root, discoveredPresets = []) {
  const assets = scene?.assets || {};
  const configuredPresets = Array.isArray(scene?.modelPresets) ? scene.modelPresets : [];
  const usedIds = new Set();
  const usedPaths = new Set();

  if (configuredPresets.length > 0) {
    const normalizedConfigured = configuredPresets.map((preset, index) => {
      const normalized = normalizeAssetEntry("model", preset, root);
      const presetId = preset.id || `model-${index + 1}`;
      usedIds.add(presetId);
      usedPaths.add(normalized.path);
      return {
        ...normalized,
        id: presetId,
        label: preset.label || preset.name || normalized.label || `Model ${index + 1}`,
        sourceId: preset.sourceId || null,
        required: preset.required !== undefined ? Boolean(preset.required) : index === 0
      };
    });

    const normalizedDiscovered = discoveredPresets
      .filter((preset) => preset?.path && !usedPaths.has(preset.path))
      .map((preset, index) => {
        const normalized = normalizeAssetEntry("model", preset, root);
        const fallbackId = `local-model-${index + 1}`;
        const baseId = preset.id || fallbackId;
        const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
        usedIds.add(id);
        usedPaths.add(normalized.path);
        return {
          ...normalized,
          id,
          label: preset.label || preset.name || normalized.label || id,
          sourceId: preset.sourceId || "local-model-folder",
          required: false
        };
      });

    return [...normalizedConfigured, ...normalizedDiscovered];
  }

  const fallbackModel = normalizeAssetEntry("model", assets.model, root);
  usedIds.add("default");
  usedPaths.add(fallbackModel.path);
  const normalizedDiscovered = discoveredPresets
    .filter((preset) => preset?.path && !usedPaths.has(preset.path))
    .map((preset, index) => {
      const normalized = normalizeAssetEntry("model", preset, root);
      const fallbackId = `local-model-${index + 1}`;
      const baseId = preset.id || fallbackId;
      const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
      usedIds.add(id);
      usedPaths.add(normalized.path);
      return {
        ...normalized,
        id,
        label: preset.label || preset.name || normalized.label || id,
        sourceId: preset.sourceId || "local-model-folder",
        required: false
      };
    });

  return [
    {
      ...fallbackModel,
      id: "default",
      label: fallbackModel.label || "Configured model",
      sourceId: null,
      required: fallbackModel.required
    },
    ...normalizedDiscovered
  ];
}

function normalizeMotionPresets(scene, root) {
  const configuredPresets = Array.isArray(scene?.motionPresets) ? scene.motionPresets : [];

  return configuredPresets.map((preset, index) => {
    const normalized = normalizeAssetEntry("motionPreset", preset, root);
    return {
      ...normalized,
      id: preset.id || `motion-${index + 1}`,
      label: preset.label || preset.name || normalized.label || `Motion ${index + 1}`,
      sourceId: preset.sourceId || null,
      kind: preset.kind || normalized.kind || "vrma",
      required: Boolean(preset.required)
    };
  });
}

function pickModelPreset(scene, modelPresets) {
  const query = new URLSearchParams(window.location.search);
  const requestedId = query.get(MODEL_PRESET_QUERY_KEY) || scene?.activeModelPreset;
  return (
    modelPresets.find((preset) => preset.id === requestedId) ||
    modelPresets.find((preset) => preset.required) ||
    modelPresets[0] ||
    null
  );
}

function pickReadyModelPreset(scene, modelPresets, fallbackId) {
  const query = new URLSearchParams(window.location.search);
  const requestedId = query.get(MODEL_PRESET_QUERY_KEY) || scene?.activeModelPreset || fallbackId;
  const requested = modelPresets.find((preset) => preset.id === requestedId);

  if (requested?.ok) {
    return requested;
  }

  return (
    modelPresets.find((preset) => preset.ok && preset.required) ||
    modelPresets.find((preset) => preset.ok) ||
    requested ||
    modelPresets.find((preset) => preset.required) ||
    modelPresets[0] ||
    null
  );
}

function normalizeAssets(config, scene, selectedModelPreset) {
  const root = config.assetRoot || "/local-resources/original-video-assets/";
  const assets = scene?.assets || {};

  return ASSET_ORDER.map((name) => {
    if (name === "model" && selectedModelPreset) {
      return {
        ...selectedModelPreset,
        name: "model",
        required: true
      };
    }

    return normalizeAssetEntry(name, assets[name], root);
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
  const root = config.assetRoot || "/local-resources/original-video-assets/";
  const discoveredModelPresets = await fetchDiscoveredModelPresets();
  const modelPresets = normalizeModelPresets(scene, root, discoveredModelPresets);
  const motionPresets = normalizeMotionPresets(scene, root);
  const requestedModelPreset = pickModelPreset(scene, modelPresets);
  const modelPresetResults = await Promise.all(
    modelPresets.map(async (preset) => {
      const probe = await probeAsset(preset.url);
      return { ...preset, ...probe };
    })
  );
  const motionPresetResults = await Promise.all(
    motionPresets.map(async (preset) => {
      const probe = await probeAsset(preset.url);
      return { ...preset, ...probe };
    })
  );
  const selectedModelPreset = pickReadyModelPreset(
    scene,
    modelPresetResults,
    requestedModelPreset?.id
  );
  const assets = normalizeAssets(config, scene, selectedModelPreset);
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
    modelPresets: modelPresetResults,
    motionPresets: motionPresetResults,
    selectedModelPreset,
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
