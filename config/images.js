// Image pipeline: picture and preloadPicture shortcodes, resizing the originals of src/img/originals with eleventy-img
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";

// Remote images (Unsplash placeholders) are downloaded into src/img/originals/remote/ the first time they are used, and committed:
// a file already there is never downloaded again, so builds (and the server) don't depend on the remote site.
// Memoized per URL: the pages of every language and the hero preload ask for the same image at the same time.
const ORIGINALS_FOLDER = "src/img/originals";
const REMOTE_IMAGE_FOLDER = `${ORIGINALS_FOLDER}/remote`;
const IMAGE_EXTENSIONS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/avif": ".avif" };
const remoteDownloads = new Map();

async function downloadRemoteImage(url) {
  const { pathname } = new URL(url);
  const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 8);
  const baseName = `${path.basename(pathname, path.extname(pathname))}-${urlHash}`;
  fs.mkdirSync(REMOTE_IMAGE_FOLDER, { recursive: true });
  const existingFile = fs.readdirSync(REMOTE_IMAGE_FOLDER).find((fileName) => path.parse(fileName).name === baseName);
  if (existingFile) return path.join(REMOTE_IMAGE_FOLDER, existingFile);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download of ${url} failed: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type")?.split(";")[0];
  const extension = IMAGE_EXTENSIONS[contentType];
  if (!extension) throw new Error(`Download of ${url}: unexpected content type "${contentType}"`);
  const localFile = path.join(REMOTE_IMAGE_FOLDER, baseName + extension);
  // Written aside then renamed, so an interrupted download never leaves a truncated image that would be reused
  fs.writeFileSync(`${localFile}.part`, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(`${localFile}.part`, localFile);
  console.log(`[images] Downloaded ${url} to ${localFile}`);
  return localFile;
}

// Path of the original to process: a file in src/img/originals, or the local copy of a remote URL
function localImageFile(source) {
  if (!/^https?:\/\//.test(source)) return `${ORIGINALS_FOLDER}/${source}`;
  if (!remoteDownloads.has(source)) {
    const download = downloadRemoteImage(source);
    // A failed download is retried on the next rebuild of `npm start` instead of staying memoized
    download.catch(() => remoteDownloads.delete(source));
    remoteDownloads.set(source, download);
  }
  return remoteDownloads.get(source);
}

export default function (eleventyConfig) {
  // Resizes an image to every width, in webp + jpeg. source: a file in src/img/originals, or a remote URL (Unsplash placeholders),
  // stored locally first by localImageFile. options.ratio ([width, height]) center-crops it; outputs go to img/<options.folder>/
  async function processImage(source, { folder, widths = [400, 800, 1200], ratio }) {
    const croppedHeight = (width) => Math.round((width * ratio[1]) / ratio[0]);
    const ratioSuffix = ratio ? `-${ratio[0]}x${ratio[1]}` : "";
    const metadata = await Image(await localImageFile(source), {
      widths,
      formats: ["webp", "jpeg"],
      urlPath: `/img/${folder}/`,
      outputDir: path.join(eleventyConfig.directories.output, `img/${folder}/`),
      sharpWebpOptions: { quality: 80, effort: 6 },
      sharpJpegOptions: { quality: 80, mozjpeg: true },
      // The crop is not part of eleventy-img's file hash: the ratio in the name renders new files when it changes
      filenameFormat: (id, originalSource, width, format) => `${id}${ratioSuffix}-${width}.${format}`,
      transform: ratio
        ? (sharp, target) => {
            sharp.resize({ width: target.width, height: croppedHeight(target.width), fit: "cover" });
          }
        : undefined,
    });
    // The returned metadata keeps the original's aspect ratio; align it with the crop so width/height attributes match it
    if (ratio) for (const entry of Object.values(metadata).flat()) entry.height = croppedHeight(entry.width);
    return metadata;
  }

  // Renders a <picture> through processImage. Extra options: class (on <picture>), sizes, lazy, priority (above-the-fold image)
  eleventyConfig.addAsyncShortcode("picture", async function (source, alt, options) {
    const metadata = await processImage(source, options);
    const imageAttributes = { alt, sizes: options.sizes, decoding: "async" };
    if (options.lazy) imageAttributes.loading = "lazy";
    if (options.priority) imageAttributes.fetchpriority = "high";
    const pictureAttributes = options.class ? { class: options.class } : {};
    return Image.generateHTML(metadata, imageAttributes, { pictureAttributes });
  });

  // <link rel="preload"> for a picture shown above the fold; given the same options, it targets the same webp files
  eleventyConfig.addAsyncShortcode("preloadPicture", async function (source, options) {
    const metadata = await processImage(source, options);
    const srcset = metadata.webp.map((entry) => entry.srcset).join(", ");
    return `<link rel="preload" as="image" type="image/webp" imagesrcset="${srcset}" imagesizes="${options.sizes}">`;
  });
}
