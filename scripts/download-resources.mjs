import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "resources/original-video-assets/manifest.json");
const localRoot = path.join(root, "local-resources/original-video-assets");
const userAgent = "MMDTest-resource-downloader/1.0";
const openManual = process.argv.includes("--open-manual");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const readFirstFileName = "READ_FIRST_SOURCE_DESCRIPTIONS.txt";

const downloads = [
  {
    label: "Bilibili source metadata",
    url: manifest.source.metadataApi,
    destination: "sources/bilibili-BV1MsZtYCE4t.json",
    kind: "json"
  },
  {
    label: "Bilibili source cover",
    url: manifest.source.coverImage,
    destination: "references/source-cover.jpg",
    kind: "binary"
  },
  {
    label: "Bilibili source first frame",
    url: manifest.source.firstFrame,
    destination: "references/source-first-frame.jpg",
    kind: "binary"
  },
  {
    label: "RedialC skin preset metadata",
    url: "https://api.bilibili.com/x/web-interface/view?bvid=BV19A411u7MG",
    destination: "sources/bilibili-BV19A411u7MG.json",
    kind: "json"
  },
  {
    label: "RedialC color-key node metadata",
    url: "https://api.bilibili.com/x/web-interface/view?bvid=BV1A3411V79D",
    destination: "sources/bilibili-BV1A3411V79D.json",
    kind: "json"
  },
  {
    label: "BowlRoll model page note",
    url: "https://bowlroll.net/api/file/112578/message",
    destination: "sources/bowlroll-112578-message.json",
    kind: "json"
  },
  {
    label: "BowlRoll motion page note",
    url: "https://bowlroll.net/api/file/261196/message",
    destination: "sources/bowlroll-261196-message.json",
    kind: "json"
  }
];

const sourceProfiles = manifest.sourceProfiles || [];

const sourceProfileManualSources = sourceProfiles.flatMap((profile) =>
  (profile.creditedAssets || []).flatMap((asset) =>
    (asset.downloadSources || []).map((source) => ({
      label: `${profile.label}: ${asset.type || "asset"}: ${asset.name || source.label}`,
      url: source.url || asset.sourceUrl,
      reason: source.reason || asset.licenseStatus || "manual download and terms review required",
      destination: asset.localPath || source.destination || "sources/"
    }))
  )
);

const modelPresetManualSources = (manifest.assets.modelPresets || []).flatMap((preset) => {
  const destination = preset.localPath || "model/";
  const sources = [];

  if (preset.sourceUrl) {
    sources.push({
      label: `Model preset: ${preset.name || preset.id}`,
      url: preset.sourceUrl,
      reason: "paid/manual shop or member source and bundled terms review required",
      destination
    });
  }

  for (const source of preset.downloadSources || []) {
    sources.push({
      label: `${preset.name || preset.id}: ${source.label}`,
      url: source.url,
      reason: source.reason || "manual download and terms review required",
      destination
    });
  }

  return sources;
});

const modelPresetDescriptionSources = (manifest.assets.modelPresets || []).flatMap((preset) => {
  const sources = [];

  if (preset.sourceVideo) {
    sources.push({
      label: `${preset.name || preset.id} reference video`,
      url: preset.sourceVideo,
      kind: "html-meta"
    });
  }
  if (preset.sourceUrl) {
    sources.push({
      label: `${preset.name || preset.id} listing`,
      url: preset.sourceUrl,
      kind: "html-meta"
    });
  }

  return sources;
});

const manualSources = [
  {
    label: "Model archive",
    url: "https://bowlroll.net/file/112578",
    reason: "login/readme review required",
    destination: "model/"
  },
  ...modelPresetManualSources,
  {
    label: "Motion/camera/facial archive",
    url: "https://bowlroll.net/file/261196",
    reason: "password flow and restricted terms",
    destination: "motion/ then copy camera/facial files as needed"
  },
  {
    label: "Music off-vocal/vocals",
    url: "https://xfs.jp/jxHc3C",
    reason: "audio rights not cleared",
    destination: "music/"
  },
  {
    label: "Stage HZ-D",
    url: manifest.assets.stage.sourceUrl,
    reason: "not publicly distributed",
    destination: "stage/"
  },
  {
    label: "RC skin node tree",
    url: manifest.assets.nodeTrees[0].downloadSources[0].url,
    reason: "cloud-drive flow/readme review required",
    destination: "nodetree/"
  },
  {
    label: "RC color-key node tree",
    url: manifest.assets.nodeTrees[1].downloadSources[0].url,
    reason: "cloud-drive flow/readme review required",
    destination: "nodetree/"
  },
  ...sourceProfileManualSources
];

const descriptionSources = [
  {
    label: "Original Bilibili video description",
    url: manifest.source.url,
    sourceFile: "sources/bilibili-BV1MsZtYCE4t.json",
    kind: "bilibili-json"
  },
  ...modelPresetDescriptionSources,
  {
    label: "Model Nico description",
    url: manifest.assets.model.sourceUrl,
    kind: "nico-watch"
  },
  {
    label: "Motion/camera/facial Nico description",
    url: manifest.assets.motion.sourceUrl,
    kind: "nico-watch"
  },
  {
    label: "Music Nico description",
    url: manifest.assets.music.sourceUrl,
    kind: "nico-watch"
  },
  {
    label: "BowlRoll model page note",
    url: manifest.assets.model.distributionUrl,
    sourceFile: "sources/bowlroll-112578-message.json",
    kind: "bowlroll-message-json"
  },
  {
    label: "BowlRoll motion page note",
    url: manifest.assets.motion.distributionUrl,
    sourceFile: "sources/bowlroll-261196-message.json",
    kind: "bowlroll-message-json"
  },
  {
    label: "RC skin node-tree Bilibili description",
    url: manifest.assets.nodeTrees[0].sourceUrl,
    sourceFile: "sources/bilibili-BV19A411u7MG.json",
    kind: "bilibili-json"
  },
  {
    label: "RC color-key node-tree Bilibili description",
    url: manifest.assets.nodeTrees[1].sourceUrl,
    sourceFile: "sources/bilibili-BV1A3411V79D.json",
    kind: "bilibili-json"
  }
];

const trackedLicenseNotes = [
  "resources/original-video-assets/LICENSE_AUDIT.md",
  "resources/original-video-assets/model/LICENSE_NOTES.md",
  "resources/original-video-assets/model/SAMEKO_SABA_LICENSE_NOTES.md",
  "resources/original-video-assets/motion/LICENSE_NOTES.md",
  "resources/original-video-assets/motion/MIXAMO_VRMA_LICENSE_NOTES.md",
  "resources/original-video-assets/motion/CMU_MOCAP_LICENSE_NOTES.md",
  "resources/original-video-assets/camera/LICENSE_NOTES.md",
  "resources/original-video-assets/facial/LICENSE_NOTES.md",
  "resources/original-video-assets/music/LICENSE_NOTES.md",
  "resources/original-video-assets/stage/LICENSE_NOTES.md",
  "resources/original-video-assets/nodetree/LICENSE_NOTES.md"
];

async function fetchWithHeaders(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      referer: "https://www.bilibili.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response;
}

async function download(item) {
  const destination = path.join(localRoot, item.destination);
  await mkdir(path.dirname(destination), { recursive: true });

  const response = await fetchWithHeaders(item.url);
  if (item.kind === "json") {
    const json = await response.json();
    await writeFile(destination, `${JSON.stringify(json, null, 2)}\n`);
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(destination, bytes);
  }

  return destination;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();

      if (code === 0) {
        resolve(output);
        return;
      }

      reject(new Error(errorOutput || `${command} exited with code ${code}`));
    });
  });
}

function extractLinks(value) {
  return [...String(value || "").matchAll(/https?:\/\/\S+/g)].map((match) =>
    match[0].replace(/[),.]+$/, "")
  );
}

function buildDownloadProfile(metadata, source) {
  const formats = (metadata.formats || [])
    .filter((format) => format.vcodec !== "none" || format.acodec !== "none")
    .map((format) => ({
      formatId: format.format_id,
      ext: format.ext,
      resolution: format.resolution,
      width: format.width || null,
      height: format.height || null,
      fps: format.fps || null,
      videoCodec: format.vcodec,
      audioCodec: format.acodec,
      bitrateKbps: format.tbr || null,
      filesizeBytes: format.filesize || format.filesize_approx || null,
      protocol: format.protocol
    }));

  return {
    generatedAt: new Date().toISOString(),
    source: {
      provider: source.provider || metadata.extractor_key || "youtube",
      id: metadata.id,
      url: metadata.webpage_url || source.url,
      title: metadata.title,
      uploader: metadata.uploader,
      channel: metadata.channel,
      channelUrl: metadata.channel_url,
      uploadDate: metadata.upload_date,
      durationSeconds: metadata.duration,
      thumbnail: metadata.thumbnail
    },
    description: metadata.description || "",
    extractedSourceLinks: extractLinks(metadata.description),
    creditedAssets: source.creditedAssets || [],
    downloadProfiles: source.downloadProfiles || {},
    formats
  };
}

async function downloadSourceProfile(source) {
  const destination = path.join(localRoot, source.destination);
  await mkdir(path.dirname(destination), { recursive: true });

  const output = await runCommand("yt-dlp", [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    source.url
  ]);
  const metadata = JSON.parse(output);
  const profile = buildDownloadProfile(metadata, source);
  await writeFile(destination, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  return destination;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&quot;", '"')
    .replaceAll("&#034;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function htmlToText(value) {
  return decodeHtml(String(value))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

async function readJsonFromLocal(relativePath) {
  const file = path.join(localRoot, relativePath);
  return JSON.parse(await readFile(file, "utf8"));
}

async function extractNicoDescription(url) {
  const response = await fetchWithHeaders(url);
  const html = await response.text();
  const serverResponse = html.match(/<meta name="server-response" content="([\s\S]*?)"\s*\/>/);

  if (serverResponse) {
    const payload = JSON.parse(decodeHtml(serverResponse[1]));
    const description = payload.data?.response?.video?.description;
    if (description) {
      return htmlToText(description);
    }
  }

  const structuredData = html.match(
    /<script data-server="1" type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  if (structuredData) {
    const payload = JSON.parse(structuredData[1]);
    if (payload.description) {
      return htmlToText(payload.description);
    }
  }

  const metaDescription = html.match(/<meta data-server="1" name="description" content="([^"]*)"/);
  return metaDescription ? htmlToText(metaDescription[1]) : "";
}

async function extractHtmlMetaDescription(url) {
  const response = await fetchWithHeaders(url);
  const html = await response.text();
  const title =
    html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ||
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
    "";
  const description =
    html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ||
    html.match(/<meta name="description" content="([^"]*)"/)?.[1] ||
    "";

  return [title, description].map(htmlToText).filter(Boolean).join("\n\n");
}

async function getDescription(source) {
  if (source.kind === "nico-watch") {
    return extractNicoDescription(source.url);
  }

  if (source.kind === "html-meta") {
    return extractHtmlMetaDescription(source.url);
  }

  const json = await readJsonFromLocal(source.sourceFile);
  if (source.kind === "bilibili-json") {
    return htmlToText(json.data?.desc || "");
  }

  if (source.kind === "bowlroll-message-json") {
    return htmlToText(json.message || "");
  }

  return "";
}

async function collectDownloadedLicensePaths(directory = localRoot) {
  const matches = [];
  const licensePattern =
    /(^|[/\\])([^/\\]*(readme|license|licence|terms|notice|credit|利用規約|規約|説明|はじめに)[^/\\]*)$/i;

  async function visit(current) {
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(root, fullPath);

      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(fullPath);
      if (fileStat.size > 25 * 1024 * 1024) {
        continue;
      }

      if (licensePattern.test(relativePath)) {
        matches.push(relativePath);
      }
    }
  }

  await visit(directory);
  return matches.sort((a, b) => a.localeCompare(b));
}

async function writeReadFirstFile() {
  const destination = path.join(localRoot, readFirstFileName);
  const now = new Date().toISOString();
  const sections = [
    "# Read First: Source Descriptions, Password Clues, and Licenses",
    "",
    `Generated: ${now}`,
    `Local root: ${localRoot}`,
    "",
    "Read these source descriptions before opening gated download pages. Passwords, extraction keys, cloud-drive codes, and creator conditions are often written in the original description rather than on the download host.",
    "",
    "## Source Descriptions"
  ];

  for (const source of descriptionSources) {
    sections.push("", `### ${source.label}`, source.url);
    try {
      const description = await getDescription(source);
      sections.push(description || "(No description text found.)");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      sections.push(`(Could not read description: ${message})`);
    }
  }

  sections.push("", "## Downloaded License / Readme File Paths");
  const downloadedLicensePaths = await collectDownloadedLicensePaths();
  if (downloadedLicensePaths.length > 0) {
    sections.push(...downloadedLicensePaths.map((licensePath) => `- ${licensePath}`));
  } else {
    sections.push(
      "- No downloaded license/readme files found yet.",
      "- After extracting manual archives, rerun `npm run resources:download` to refresh this list."
    );
  }

  sections.push(
    "",
    "## Tracked License Notes",
    ...trackedLicenseNotes.map((licensePath) => `- ${licensePath}`),
    "",
    "## Manual Source Downloads"
  );

  for (const source of manualSources) {
    sections.push(
      "",
      `### ${source.label}`,
      `Source: ${source.url || "No public URL"}`,
      `Save under: ${source.destination}`,
      `Why manual: ${source.reason}`
    );
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${sections.join("\n")}\n`);
  return destination;
}

function openUrl(url) {
  if (!url) {
    return Promise.resolve(false);
  }

  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", url]
      : [url];

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });
    child.on("error", () => resolve(false));
    child.unref();
    resolve(true);
  });
}

async function writeManualChecklist() {
  const destination = path.join(localRoot, "manual-downloads.html");
  const readFirstPath = path.join(localRoot, readFirstFileName);
  const rows = manualSources
    .map((source) => {
      const href = source.url
        ? `<a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a>`
        : "No public URL";
      return `<tr>
        <td>${escapeHtml(source.label)}</td>
        <td>${href}</td>
        <td>${escapeHtml(source.destination)}</td>
        <td>${escapeHtml(source.reason)}</td>
      </tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>MMDTest Manual Downloads</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; line-height: 1.45; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #f3f5f7; }
      code { background: #f3f5f7; padding: 2px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>MMDTest Manual Downloads</h1>
    <h2>Read first</h2>
    <p><a href="${escapeHtml(readFirstFileName)}">${escapeHtml(readFirstFileName)}</a></p>
    <p>Start with this text file before opening source downloads. It contains source descriptions, password clues, and discovered local license/readme file paths.</p>
    <p>Download files only when you can follow the source site's terms. Keep original readmes/licenses beside the files.</p>
    <p>Local root: <code>${escapeHtml(localRoot)}</code></p>
    <p>Read-first file: <code>${escapeHtml(readFirstPath)}</code></p>
    <table>
      <thead>
        <tr><th>Item</th><th>Source</th><th>Save under</th><th>Why manual</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>
`;
  await writeFile(destination, html);
  return destination;
}

console.log(`Writing public resource data to ${localRoot}`);

for (const item of downloads) {
  try {
    const destination = await download(item);
    console.log(`downloaded: ${item.label} -> ${path.relative(root, destination)}`);
  } catch (error) {
    console.log(
      `skipped: ${item.label} (${error instanceof Error ? error.message : "unknown error"})`
    );
  }
}

for (const profile of sourceProfiles) {
  try {
    const destination = await downloadSourceProfile(profile);
    console.log(`profiled: ${profile.label} -> ${path.relative(root, destination)}`);
  } catch (error) {
    console.log(
      `skipped: ${profile.label} (${error instanceof Error ? error.message : "unknown error"})`
    );
  }
}

console.log("\nManual/gated sources:");
for (const source of manualSources) {
  console.log(`- ${source.label}: ${source.url || "no public URL"} (${source.reason})`);
}

const readFirst = await writeReadFirstFile();
console.log(`\nread first: ${path.relative(root, readFirst)}`);
const checklist = await writeManualChecklist();
console.log(`\nmanual checklist: ${path.relative(root, checklist)}`);

if (openManual) {
  console.log("\nOpening manual/auth pages in your browser...");
  await openUrl(`file://${checklist}`);
  for (const source of manualSources) {
    if (!source.url) {
      continue;
    }
    const opened = await openUrl(source.url);
    console.log(`${opened ? "opened" : "could not open"}: ${source.label}`);
  }
}
