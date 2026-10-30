# EcoRéno Max website

Static site built with [Eleventy](https://www.11ty.dev/) (v3, Node >= 22): every page is generated once per language, in `/fr/` (default) and `/nl/`.

## Build

```bash
npm install
npm start        # dev server with live reload on http://localhost:8080/
npm run build    # writes the site to _site/
```

## Deploy

Every push on `master` runs the e2e tests (`.github/workflows/e2e.yml`); when they pass, `.github/workflows/deploy.yml` connects to the server over SSH, which runs `scripts/deploy.sh`.
It can also be started by hand from the Actions tab (*Deploy* → *Run workflow*).

`scripts/deploy.sh` builds the latest `master` on the server and publishes it atomically.
It stops at the first error, and a failed build leaves the live site untouched. Layout under `DEPLOY_ROOT` (default `/srv/ecoreno`):

```
repo/                   git checkout of master; keeps node_modules/ and .cache/ (remote images, downloaded once)
releases/<date>-<sha>/  one built site per deploy, the 5 newest are kept
current                 symlink to the live release: the web server's document root
```

Before building, it checks that `git`, `node`, `npm` and `flock` are installed, and `npm ci --engine-strict` refuses a Node version that doesn't match `engines` in `package.json`.
The checkout is reset to `origin/master`: never edit files in `repo/` on the server. A change to `deploy.sh` applies from the next deploy.

One-time server setup:

1. clone the repository into `/srv/ecoreno/repo` (another location: set `DEPLOY_ROOT` in the forced command);
2. restrict the CI key to the script in the deploy user's `~/.ssh/authorized_keys`:
   `command="/srv/ecoreno/repo/scripts/deploy.sh",restrict ssh-ed25519 AAAA...`
3. point the web server's document root at `/srv/ecoreno/current`, readable by the web server user (`releases/` included).

GitHub secrets: `DEPLOY_SSH_KEY` (private key), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -p <port> <host>`), `DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PORT` (optional, default 22).

To roll back, point `current` at a previous release: `ln -sfn /srv/ecoreno/releases/<release> /srv/ecoreno/current`.

## Folder layout

```
_data/
  site.json              site url, default language, language list (switcher order), contact details
  skills.json            services carousel: translation key id, Font Awesome icon, image
  i18n/fr.json, nl.json  translations, one flat key -> text dictionary per language
  i18n/common.json       texts identical in every language
_includes/layouts/
  base.njk               <head>, header, language switcher, footer
  home.njk, projects.njk page bodies, written once for all languages
_includes/partials/
  contact-link.njk       contactLink macro: email / phone link from site.contact
fr/, nl/                 one stub per page, only picks its layout
index.njk                root fallback redirecting / to /fr/
eleventy.config.js       i18n plugin, `t` filter, `picture` / `preloadPicture` shortcodes, copied assets
scripts/deploy.sh        server-side build and atomic publish, run by the Deploy workflow
css/, js/, img/          copied as-is, except img/src
img/src/                 full-size photos (projects, skills/), processed at build time (not copied)
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

## Images

Every photo goes through `{% picture source, alt, options %}` (in `eleventy.config.js`, via [@11ty/eleventy-img](https://www.11ty.dev/docs/plugins/image/)), which renders a `<picture>` in webp with a jpeg fallback, written to `_site/img/<folder>/`.

- `source`: a file in `img/src/`, or a remote URL (the Unsplash placeholders), downloaded at the first build and cached in `.cache/`
- `options`: `folder` (output folder, required), `widths` (default `[400, 800, 1200]`), `ratio` (e.g. `[16, 9]`, center-crops the image), `sizes`, `class` (on `<picture>`), `lazy`, `priority` (`fetchpriority="high"`, for the hero)

The ratio is part of the output file names, so changing a crop renders new files.
`{% preloadPicture source, options %}` writes the `<link rel="preload">` of an above-the-fold picture; given the same options, it targets the same files (used for the hero, whose options are in the `hero` front matter of `home.njk`).

To add a project, drop its `<name>-before.jpg` and `<name>-after.jpg` originals in `img/src/` and add an entry to `projects` in `_includes/layouts/projects.njk`.

To add a service, add an entry to `_data/skills.json` (`image`: an Unsplash URL or a file in `img/src/skills/`) and its `skill.<id>` and `skill.<id>-alt` keys to every language file.

## Contact details

The email, phone and VAT number are in `site.contact` (`_data/site.json`); the header and the contact section render the links with the `contactLink` macro.

## Language switcher

Flags are `img/flags/<language code>.svg`; replace the files to change their design.

## Server

`/` should redirect to `/fr/`. The generated `_site/index.html` does it with a meta refresh; on nginx, prefer:

```nginx
location = / { return 301 /fr/; }
```
