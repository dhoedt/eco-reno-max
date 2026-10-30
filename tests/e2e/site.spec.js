import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

function readData(file) {
  return JSON.parse(readFileSync(new URL(`../../_data/${file}`, import.meta.url), "utf8"));
}

const site = readData("site.json");
const commonDictionary = readData("i18n/common.json");
const dictionaries = Object.fromEntries(
  site.languages.map((language) => [language.code, readData(`i18n/${language.code}.json`)]),
);

// Same lookup order as the translate filter in eleventy.config.js
function translate(key, language) {
  return key in dictionaries[language] ? dictionaries[language][key] : commonDictionary[key];
}

// path: the page path inside a language folder, e.g. "/projects/"
const pageTemplates = [
  { name: "home", path: "/" },
  { name: "projects", path: "/projects/" },
];
const pages = site.languages.flatMap((language) =>
  pageTemplates.map((template) => ({ ...template, language: language.code, url: `/${language.code}${template.path}` })),
);

// Every root-relative URL a page links to or loads: links, scripts, stylesheets, images and their srcset candidates
async function collectLocalUrls(page) {
  const urls = await page.evaluate(() => {
    const found = [];
    document.querySelectorAll("[href], [src]").forEach((element) => {
      found.push(element.getAttribute("href") ?? element.getAttribute("src"));
    });
    document.querySelectorAll("[srcset], [imagesrcset]").forEach((element) => {
      const srcset = element.getAttribute("srcset") ?? element.getAttribute("imagesrcset");
      srcset.split(",").forEach((candidate) => found.push(candidate.trim().split(/\s+/)[0]));
    });
    return found;
  });
  // Without the #fragment: the house.svg segments are one file
  const localUrls = urls.filter((url) => url && url.startsWith("/") && !url.startsWith("//")).map((url) => url.split("#")[0]);
  return [...new Set(localUrls)];
}

test("the root redirects to the default language", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(`/${site.defaultLanguage}/`);
});

for (const { name, url, language } of pages) {
  test.describe(url, () => {
    test("renders in its language", async ({ page }) => {
      const response = await page.goto(url);
      expect(response.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page).toHaveTitle(translate(`meta.${name}.title`, language));
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S/);
    });

    // Only the site's own files: an outage of the font CDNs (Google Fonts, cdnjs) must not fail the test
    test("has no console errors and no failed local requests", async ({ page, baseURL }) => {
      const problems = [];
      page.on("console", (message) => {
        if (message.type() === "error" && message.location().url.startsWith(baseURL)) {
          problems.push(`console: ${message.text()}`);
        }
      });
      page.on("requestfailed", (request) => {
        if (request.url().startsWith(baseURL)) problems.push(`failed: ${request.url()}`);
      });
      page.on("response", (response) => {
        if (response.url().startsWith(baseURL) && response.status() >= 400) {
          problems.push(`${response.status()}: ${response.url()}`);
        }
      });
      await page.goto(url, { waitUntil: "load" });
      expect(problems).toEqual([]);
    });

    test("has canonical and hreflang links", async ({ page, request }) => {
      await page.goto(url);
      const path = url.slice(language.length + 1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${site.url}${url}`);
      const expectedAlternates = {
        ...Object.fromEntries(site.languages.map((other) => [other.code, `${site.url}/${other.code}${path}`])),
        "x-default": `${site.url}/${site.defaultLanguage}${path}`,
      };
      for (const [hreflang, href] of Object.entries(expectedAlternates)) {
        const alternate = page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`);
        await expect(alternate).toHaveAttribute("href", href);
        const response = await request.get(href.replace(site.url, ""));
        expect(response.status(), href).toBe(200);
      }
    });

    test("has no broken internal links or assets", async ({ page, request }) => {
      await page.goto(url);
      const brokenUrls = [];
      for (const localUrl of await collectLocalUrls(page)) {
        const response = await request.get(localUrl);
        if (response.status() !== 200) brokenUrls.push(`${response.status()}: ${localUrl}`);
      }
      expect(brokenUrls).toEqual([]);
    });

    test("gives every image an alt text", async ({ page }) => {
      await page.goto(url);
      // Only decorative images may have an empty alt: the hero background and the flags next to the language code
      const imagesMissingAlt = await page.evaluate(() =>
        Array.from(document.querySelectorAll("img"))
          .filter((image) => {
            const alt = image.getAttribute("alt");
            if (alt === null) return true;
            const isDecorative = image.closest(".hero-bg") || image.getAttribute("src")?.startsWith("/img/flags/");
            return alt.trim() === "" && !isDecorative;
          })
          .map((image) => image.currentSrc || image.getAttribute("src")),
      );
      expect(imagesMissingAlt).toEqual([]);
    });
  });
}

// Navigation must work without client-side JavaScript: these tests run with and without it
function navigationTests() {
  test("the language switcher keeps the current page", async ({ page }) => {
    await page.goto("/fr/projects/");
    await page.locator(".lang-selector summary").click();
    await page.locator('.lang-selector a[hreflang="nl"]').click();
    await expect(page).toHaveURL("/nl/projects/");
    await expect(page.locator('.lang-selector a[hreflang="nl"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator('.lang-selector a[hreflang="fr"]')).not.toHaveAttribute("aria-current", "page");
  });

  test("internal links stay in the current language", async ({ page }) => {
    await page.goto("/nl/");
    await expect(page.locator("header nav a.cta")).toHaveAttribute("href", "/nl/projects/");
    await page.locator(".hero-content a.cta").click();
    await expect(page).toHaveURL("/nl/projects/");
    await page.locator("header nav a").first().click();
    await expect(page).toHaveURL("/nl/");
  });
}

test.describe("navigation", navigationTests);

test.describe("navigation without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  navigationTests();
});

test.describe("small phone", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const { url } of pages) {
    test(`${url} does not scroll horizontally`, async ({ page }) => {
      await page.goto(url);
      const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
    });
  }
});
