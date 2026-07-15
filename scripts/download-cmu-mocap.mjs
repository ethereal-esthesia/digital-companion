#!/usr/bin/env node
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = process.cwd();
const localRoot = path.join(root, "local-resources/original-video-assets");
const sourceRoot = path.join(localRoot, "motion/cmu-mocap");
const rawRoot = path.join(sourceRoot, "raw");
const archiveUrl = "http://mocap.cs.cmu.edu/allasfamc.zip";
const homeUrl = "http://mocap.cs.cmu.edu/";
const faqUrl = "http://mocap.cs.cmu.edu/faqs.php";
const userAgent = "soulecho-cmu-mocap-downloader/1.0";
const archivePath = path.join(rawRoot, "allasfamc.zip");
const metadataPath = path.join(sourceRoot, "download-metadata.json");
const readmePath = path.join(sourceRoot, "README_LOCAL.txt");

function relative(filePath) {
  return path.relative(root, filePath);
}

async function getFileSize(filePath) {
  try {
    return (await stat(filePath)).size;
  } catch {
    return 0;
  }
}

async function fetchWithHeaders(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "user-agent": userAgent,
      ...(options.headers || {})
    }
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response;
}

async function downloadText(url, destination) {
  const response = await fetchWithHeaders(url);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, await response.text(), "utf8");
}

async function getRemoteArchiveSize() {
  const response = await fetchWithHeaders(archiveUrl, { method: "HEAD" });
  return Number(response.headers.get("content-length") || 0);
}

async function writeLocalReadme(remoteSize) {
  const contents = [
    "# CMU Motion Capture Database",
    "",
    "Downloaded by `npm run resources:download:cmu`.",
    "",
    `Archive: ${archiveUrl}`,
    `Archive size: ${remoteSize || "unknown"} bytes`,
    "",
    "This folder is intentionally ignored by git and is not installed into the app config.",
    "The archive contains the official all-ASF/AMC zip from the CMU Graphics Lab Motion Capture Database.",
    "",
    "License / use summary:",
    "- CMU states the data may be included in commercially sold products.",
    "- CMU states the data may not be resold directly, even in converted form.",
    "- The FAQ says the motion capture data may be copied, modified, or redistributed without permission.",
    "- CMU requests attribution when publishing results.",
    "",
    "Suggested attribution:",
    "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.",
    "",
    "Sources checked:",
    `- ${homeUrl}`,
    `- ${faqUrl}`,
    "",
    "Do not extract or wire these motions into a public demo until a conversion/import step explicitly chooses which files to use."
  ].join("\n");

  await writeFile(readmePath, `${contents}\n`, "utf8");
}

async function downloadArchive(remoteSize) {
  await mkdir(rawRoot, { recursive: true });

  const existingSize = await getFileSize(archivePath);
  if (remoteSize > 0 && existingSize === remoteSize) {
    console.log(`already downloaded: ${relative(archivePath)} (${existingSize} bytes)`);
    return existingSize;
  }

  const headers = {};
  let append = false;
  if (existingSize > 0 && (!remoteSize || existingSize < remoteSize)) {
    headers.Range = `bytes=${existingSize}-`;
    append = true;
    console.log(`resuming: ${relative(archivePath)} from byte ${existingSize}`);
  } else if (existingSize > remoteSize && remoteSize > 0) {
    console.log(`local archive is larger than remote; restarting: ${relative(archivePath)}`);
  }

  const response = await fetchWithHeaders(archiveUrl, { headers });
  if (append && response.status !== 206) {
    append = false;
    console.log("server did not honor resume; restarting archive download");
  }

  const total = remoteSize || Number(response.headers.get("content-length") || 0);
  const writeStream = createWriteStream(archivePath, { flags: append ? "a" : "w" });
  await pipeline(Readable.fromWeb(response.body), writeStream);

  const finalSize = await getFileSize(archivePath);
  if (remoteSize > 0 && finalSize !== remoteSize) {
    throw new Error(`Archive size mismatch: expected ${remoteSize}, got ${finalSize}`);
  }

  console.log(`downloaded: ${relative(archivePath)} (${finalSize}/${total || "unknown"} bytes)`);
  return finalSize;
}

async function main() {
  await mkdir(sourceRoot, { recursive: true });
  console.log(`Writing CMU mocap data to ${sourceRoot}`);

  const remoteSize = await getRemoteArchiveSize();
  await downloadText(homeUrl, path.join(sourceRoot, "cmu-mocap-home.html"));
  await downloadText(faqUrl, path.join(sourceRoot, "cmu-mocap-faqs.html"));
  const downloadedBytes = await downloadArchive(remoteSize);
  await writeLocalReadme(remoteSize);

  const metadata = {
    downloadedAt: new Date().toISOString(),
    archiveUrl,
    homeUrl,
    faqUrl,
    archivePath: path.relative(localRoot, archivePath),
    downloadedBytes,
    remoteBytes: remoteSize,
    installed: false,
    licenseStatus: "free-to-include-in-products-not-for-direct-resale",
    attribution:
      "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`source snapshot: ${relative(path.join(sourceRoot, "cmu-mocap-home.html"))}`);
  console.log(`faq snapshot: ${relative(path.join(sourceRoot, "cmu-mocap-faqs.html"))}`);
  console.log(`metadata: ${relative(metadataPath)}`);
  console.log(`readme: ${relative(readmePath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
