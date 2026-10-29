import { I18nPlugin } from "@11ty/eleventy";
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

  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  // img/src holds the full-size originals that img/compress.py turns into img/400, 800 and 1200
  eleventyConfig.addPassthroughCopy("img/*.svg");
  eleventyConfig.addPassthroughCopy("img/{flags,skills,400,800,1200}/**");

  eleventyConfig.ignores.add(".venv/**");
  eleventyConfig.ignores.add(".playwright-cli/**");
  eleventyConfig.ignores.add(".claude/**");
  eleventyConfig.ignores.add("sandbox/**");
}

export const config = {
  templateFormats: ["njk"],
};
