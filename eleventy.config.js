import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { I18nPlugin } from "@11ty/eleventy";
import * as solidIcons from "@fortawesome/free-solid-svg-icons";
import images from "./_config/images.js";
import site from "./_data/site.json" with { type: "json" };

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(I18nPlugin, {
    defaultLanguage: site.defaultLanguage,
    errorMode: "strict",
  });
  // picture and preloadPicture shortcodes
  eleventyConfig.addPlugin(images);

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

  // Inline SVG of a Font Awesome solid icon, e.g. "fa-house": only the icons in use reach the page, no icon font is loaded
  eleventyConfig.addShortcode("icon", function (name) {
    const exportName = name.replace(/-(\w)/g, (match, letter) => letter.toUpperCase());
    const definition = solidIcons[exportName];
    if (!definition) throw new Error(`icon: no Font Awesome solid icon "${name}"`);
    const [width, height, , , pathData] = definition.icon;
    return `<svg class="icon" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false"><path d="${pathData}"/></svg>`;
  });

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  // img/src holds the full-size originals, processed by the picture shortcode instead of being copied
  eleventyConfig.addPassthroughCopy("img/*.svg");
  eleventyConfig.addPassthroughCopy("img/flags/**");
  // Self-hosted variable fonts (latin subset), declared in css/base.css: no request to Google Fonts
  eleventyConfig.addPassthroughCopy({
    "node_modules/@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2": "fonts/fraunces-latin-opsz-normal.woff2",
    "node_modules/@fontsource-variable/urbanist/files/urbanist-latin-wght-normal.woff2": "fonts/urbanist-latin-wght-normal.woff2",
  });

  eleventyConfig.ignores.add(".playwright-cli/**");
  eleventyConfig.ignores.add(".claude/**");
  eleventyConfig.ignores.add("sandbox/**");
}

export const config = {
  templateFormats: ["njk"],
};
