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
  eleventyConfig.addFilter("t", function (key) {
    const language = this.page.lang;
    const dictionary = this.ctx.i18n[language];
    const commonDictionary = this.ctx.i18n.common;
    if (!dictionary) throw new Error(`No dictionary _data/i18n/${language}.json`);
    if (key in dictionary) return dictionary[key];
    if (key in commonDictionary) return commonDictionary[key];
    throw new Error(`Missing translation key "${key}" in _data/i18n/${language}.json and _data/i18n/common.json`);
  });

  // Renders a <picture> from a full-size original in img/src: center-cropped to 16:9, resized to every width, in webp + jpeg
  eleventyConfig.addAsyncShortcode("croppedPicture", async function (source, alt, pictureClass, sizes, lazy) {
    const croppedHeight = (width) => Math.round((width * 9) / 16);
    const metadata = await Image(`img/src/${source}`, {
      widths: [400, 800, 1200],
      formats: ["webp", "jpeg"],
      urlPath: "/img/projects/",
      outputDir: path.join(eleventyConfig.directories.output, "img/projects/"),
      sharpWebpOptions: { quality: 90, effort: 6 },
      sharpJpegOptions: { quality: 90, mozjpeg: true },
      transform: (sharp, target) => {
        sharp.resize({ width: target.width, height: croppedHeight(target.width), fit: "cover" });
      },
    });
    // The returned metadata keeps the original's aspect ratio; align it with the crop so width/height attributes are 16:9
    for (const entry of Object.values(metadata).flat()) entry.height = croppedHeight(entry.width);
    const imageAttributes = { alt, sizes, decoding: "async" };
    if (lazy) imageAttributes.loading = "lazy";
    return Image.generateHTML(metadata, imageAttributes, { pictureAttributes: { class: pictureClass } });
  });

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  // img/src holds the full-size originals, processed by the croppedPicture shortcode instead of being copied
  eleventyConfig.addPassthroughCopy("img/*.svg");
  eleventyConfig.addPassthroughCopy("img/{flags,skills}/**");

  eleventyConfig.ignores.add(".playwright-cli/**");
  eleventyConfig.ignores.add(".claude/**");
  eleventyConfig.ignores.add("sandbox/**");
}

export const config = {
  templateFormats: ["njk"],
};
