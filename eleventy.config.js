import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { I18nPlugin } from "@11ty/eleventy";
import Image from "@11ty/eleventy-img";
import site from "./_data/site.json" with { type: "json" };

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(I18nPlugin, {
    defaultLanguage: site.defaultLanguage,
    errorMode: "strict",
  });

  // Looks a key up in _data/i18n/<page language>.json, then in _data/i18n/common.json for strings shared by all languages;
  // a missing key fails the build instead of shipping an untranslated page
  eleventyConfig.addFilter("translate", function (key) {
    const language = this.page.lang;
    const dictionary = this.ctx.i18n[language];
    const commonDictionary = this.ctx.i18n.common;
    if (!dictionary) throw new Error(`No dictionary _data/i18n/${language}.json`);
    if (key in dictionary) return dictionary[key];
    if (key in commonDictionary) return commonDictionary[key];
    throw new Error(`Missing translation key "${key}" in _data/i18n/${language}.json and _data/i18n/common.json`);
  });

  // Cache busting for passthrough-copied assets: appends a hash of the file's content, so its URL only changes with it
  // and the server can cache it forever. "/img/house.svg#segment" -> "/img/house.svg?v=<hash>#segment".
  // Hashed on every call (not memoized) so `npm start` picks up edited files; a missing file fails the build.
  eleventyConfig.addFilter("asset_url", function (url) {
    const [assetPath, fragment] = url.split("#");
    const sourceFile = path.join(eleventyConfig.directories.input, assetPath);
    if (!fs.existsSync(sourceFile)) throw new Error(`asset_url: no file ${sourceFile} for "${url}"`);
    const hash = createHash("sha256").update(fs.readFileSync(sourceFile)).digest("hex").slice(0, 10);
    return `${assetPath}?v=${hash}${fragment === undefined ? "" : `#${fragment}`}`;
  });

  // Resizes an image to every width, in webp + jpeg. source: a file in img/src, or a remote URL (Unsplash placeholders),
  // downloaded once and cached in .cache/. options.ratio ([width, height]) center-crops it; outputs go to img/<options.folder>/
  async function processImage(source, { folder, widths = [400, 800, 1200], ratio }) {
    const isRemote = /^https?:\/\//.test(source);
    const croppedHeight = (width) => Math.round((width * ratio[1]) / ratio[0]);
    const ratioSuffix = ratio ? `-${ratio[0]}x${ratio[1]}` : "";
    const metadata = await Image(isRemote ? source : `img/src/${source}`, {
      widths,
      formats: ["webp", "jpeg"],
      urlPath: `/img/${folder}/`,
      outputDir: path.join(eleventyConfig.directories.output, `img/${folder}/`),
      sharpWebpOptions: { quality: 90, effort: 6 },
      sharpJpegOptions: { quality: 90, mozjpeg: true },
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

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  // img/src holds the full-size originals, processed by the picture shortcode instead of being copied
  eleventyConfig.addPassthroughCopy("img/*.svg");
  eleventyConfig.addPassthroughCopy("img/flags/**");

  eleventyConfig.ignores.add(".playwright-cli/**");
  eleventyConfig.ignores.add(".claude/**");
  eleventyConfig.ignores.add("sandbox/**");
}

export const config = {
  templateFormats: ["njk"],
};
