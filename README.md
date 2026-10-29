# EcoRéno Max website

Static site built with [Eleventy](https://www.11ty.dev/) (v3, Node >= 18): every page is generated once per language, in `/fr/` (default) and `/nl/`.

## Build

```bash
npm install
npm start        # dev server with live reload on http://localhost:8080/
npm run build    # writes the site to _site/
```

Deploy the content of `_site/`.

## Folder layout

```
_data/
  site.json              site url, default language, language list (switcher order)
  i18n/fr.json, nl.json  translations, one flat key -> text dictionary per language
  i18n/common.json       texts identical in every language
_includes/layouts/
  base.njk               <head>, header, language switcher, footer
  home.njk, projects.njk page bodies, written once for all languages
fr/, nl/                 one stub per page, only picks its layout
index.njk                root fallback redirecting / to /fr/
eleventy.config.js       i18n plugin, `t` filter, copied assets
css/, js/, img/          copied as-is (img/src originals excluded)
```

## Translations

Templates call `{{ "key" | t }}`; add `| safe` only when the text holds markup (e.g. `<strong>`).
The filter looks the key up in the page language's dictionary, then in `common.json`.
A key missing from both fails the build.

To add a text:

1. add the key to `_data/i18n/fr.json` and `_data/i18n/nl.json`, or once to `common.json` if it doesn't change between languages;
2. use it in the layout: `{{ "section.key" | t }}`, including for `alt` and `aria-label` attributes.

Internal links go through `locale_url` so they stay in the current language: `{{ '/fr/projects/' | locale_url }}`.

To add a page, create its layout in `_includes/layouts/` (chained to `layouts/base.njk`) and a stub per language in `fr/` and `nl/`.

## Language switcher

Flags are `img/flags/<language code>.svg`; replace the files to change their design.

## Server

`/` should redirect to `/fr/`. The generated `_site/index.html` does it with a meta refresh; on nginx, prefer:

```nginx
location = / { return 301 /fr/; }
```
