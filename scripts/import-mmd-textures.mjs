import { constants as fsConstants } from "node:fs";
import { access, copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import iconv from "iconv-lite";

const root = process.cwd();
const configPath = path.join(root, "local-resources/original-video-assets/config.json");
const localRoot = path.join(root, "local-resources/original-video-assets");
const parserPath = path.join(root, "node_modules/three-stdlib/libs/mmdparser.js");
const overwrite = process.argv.includes("--overwrite");
const dryRun = process.argv.includes("--dry-run");

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function toPosixPath(value) {
  return value.replaceAll("\\", "/");
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readConfigModelPath() {
  const modelArg = getArgValue("--model");
  if (modelArg) {
    return path.resolve(root, modelArg);
  }

  const config = JSON.parse(await readFile(configPath, "utf8"));
  const scenes = Array.isArray(config.scenes) ? config.scenes : [];
  const scene = scenes.find((item) => item.id === config.activeScene) || scenes[0];
  const model = scene?.assets?.model;
  const modelPath = typeof model === "string" ? model : model?.path;

  if (!modelPath) {
    throw new Error("No model path is configured in local-resources/original-video-assets/config.json");
  }

  return path.join(localRoot, trimSlashes(modelPath));
}

async function parsePmxTextures(modelPath) {
  const { Parser } = await import(pathToFileURL(parserPath).href);
  const buffer = await readFile(modelPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const parser = new Parser();
  const data = parser.parsePmx(arrayBuffer, true);
  return unique(data.textures || []).map(toPosixPath);
}

function legacyMacRomanName(value) {
  return iconv.decode(iconv.encode(value, "shift_jis"), "macintosh");
}

function legacyLatin1Name(value) {
  return iconv.decode(iconv.encode(value, "shift_jis"), "latin1");
}

function legacyCp437Name(value) {
  return iconv.decode(iconv.encode(value, "shift_jis"), "cp437");
}

function getLegacyCandidates(texturePath) {
  const parts = toPosixPath(texturePath).split("/");
  const transforms = [
    (part) => part,
    legacyMacRomanName,
    legacyLatin1Name,
    legacyCp437Name
  ];

  return unique(
    transforms.map((transform) => parts.map((part) => transform(part)).join(path.sep))
  );
}

async function findCaseInsensitiveFile(directory, relativePath) {
  const parts = toPosixPath(relativePath).split("/");
  let current = directory;

  for (const part of parts) {
    let entries;
    try {
      entries = await readdir(current);
    } catch {
      return "";
    }

    const match = entries.find((entry) => entry.toLowerCase() === part.toLowerCase());
    if (!match) {
      return "";
    }
    current = path.join(current, match);
  }

  return current;
}

async function resolveTextureSource(modelDirectory, texturePath) {
  const directPath = path.join(modelDirectory, texturePath);
  if (await exists(directPath)) {
    return { source: directPath, strategy: "already-present" };
  }

  for (const candidate of getLegacyCandidates(texturePath)) {
    const candidatePath = path.join(modelDirectory, candidate);
    if (await exists(candidatePath)) {
      return { source: candidatePath, strategy: "legacy-encoded-name" };
    }
  }

  const insensitivePath = await findCaseInsensitiveFile(modelDirectory, texturePath);
  if (insensitivePath) {
    return { source: insensitivePath, strategy: "case-insensitive-name" };
  }

  return { source: "", strategy: "missing" };
}

async function importTexture(modelDirectory, texturePath) {
  const destination = path.join(modelDirectory, texturePath);
  const resolved = await resolveTextureSource(modelDirectory, texturePath);

  if (resolved.strategy === "already-present") {
    return { texturePath, destination, ...resolved, action: "ok" };
  }

  if (!resolved.source) {
    return { texturePath, destination, ...resolved, action: "missing" };
  }

  if ((await exists(destination)) && !overwrite) {
    return { texturePath, destination, ...resolved, action: "skipped-existing" };
  }

  if (!dryRun) {
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(resolved.source, destination);
  }

  return {
    texturePath,
    destination,
    ...resolved,
    action: dryRun ? "would-copy" : "copied"
  };
}

const modelPath = await readConfigModelPath();
const modelDirectory = path.dirname(modelPath);
const textures = await parsePmxTextures(modelPath);
const results = [];

for (const texturePath of textures) {
  results.push(await importTexture(modelDirectory, texturePath));
}

const report = {
  modelPath: path.relative(root, modelPath),
  modelDirectory: path.relative(root, modelDirectory),
  dryRun,
  overwrite,
  total: results.length,
  copied: results.filter((item) => item.action === "copied").length,
  ready: results.filter((item) => item.action === "ok" || item.action === "copied").length,
  missing: results.filter((item) => item.action === "missing").map((item) => item.texturePath),
  results: results.map((item) => ({
    texturePath: item.texturePath,
    action: item.action,
    strategy: item.strategy,
    source: item.source ? path.relative(root, item.source) : "",
    destination: path.relative(root, item.destination)
  }))
};

const reportPath = path.join(modelDirectory, "texture-import-report.json");
if (!dryRun) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

for (const item of report.results) {
  const source = item.source ? ` <- ${item.source}` : "";
  console.log(`${item.action}: ${item.texturePath}${source}`);
}

console.log(
  `\n${report.ready}/${report.total} textures ready` +
    (report.missing.length > 0 ? `; missing ${report.missing.length}` : "")
);
if (!dryRun) {
  console.log(`report: ${path.relative(root, reportPath)}`);
}
