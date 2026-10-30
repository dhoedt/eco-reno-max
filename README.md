# EcoRéno Max website

Static site built with [Eleventy](https://www.11ty.dev/) (v3, Node >= 22): every page is generated once per language, in `/fr/` (default) and `/nl/`.

## Build

```bash
npm install
npm start        # dev server with live reload on http://localhost:8080/
npm run build    # writes the site to _site/
```

## Deploy

Every push on `master` runs the e2e tests (`.github/workflows/e2e.yml`); when they pass, `.github/workflows/deploy.yml` connects to the server over SSH, which runs `scripts/deploy.sh` on the commit that was tested, not on whatever `master` has become since.
It can also be started by hand from the Actions tab (*Deploy* → *Run workflow*), with an optional commit of `master` (full or short SHA, e.g. to roll back); left empty, it deploys the latest `master` without waiting for the tests.

`scripts/deploy.sh [commit]` builds a commit of `master` on the server (the latest one without argument) and publishes it atomically.
CI sends the commit as the ssh command, which the forced command receives in `SSH_ORIGINAL_COMMAND`; anything but a SHA, or a commit that is not on `master`, is refused.
It stops at the first error, and a failed build leaves the live site untouched. Layout under `DEPLOY_ROOT` (default `/var/www/ecorenomax`):

```
repo/                   git checkout of the deployed commit; keeps node_modules/ between deploys
releases/<date>-<sha>/  one built site per deploy, the 5 newest are kept
current                 symlink to the live release: the web server's document root
```

Before building, it checks that `git`, `node`, `npm` and `flock` are installed, and `npm ci --engine-strict` refuses a Node version that doesn't match `engines` in `package.json`.
The checkout is reset to the deployed commit: never edit files in `repo/` on the server. A change to `deploy.sh` applies from the next deploy.

One-time server setup:

1. clone the repository into `/var/www/ecorenomax/repo` (another location: set `DEPLOY_ROOT` in the forced command);
2. restrict the CI key to the script in the deploy user's `~/.ssh/authorized_keys`:
   `command="/var/www/ecorenomax/repo/scripts/deploy.sh",restrict ssh-ed25519 AAAA...`
3. point the web server's document root at `/var/www/ecorenomax/current`, readable by the web server user (`releases/` included).

GitHub secrets: `DEPLOY_SSH_KEY` (private key), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -p <port> <host>`), `DEPLOY_USER`, `DEPLOY_HOST`, `DEPLOY_PORT` (optional, default 22).

To roll back, point `current` at a previous release: `ln -sfn /var/www/ecorenomax/releases/<release> /var/www/ecorenomax/current`, or deploy an older commit by hand.

## Folder layout

```
_data/
  site.json              site url, default language, language list (switcher order), contact details
  skills.json            services carousel: translation key id, icon name, image
  i18n/fr.json, nl.json  translations, one flat key -> text dictionary per language
  i18n/common.json       texts identical in every language
_includes/layouts/
  base.njk               <head>, header, language switcher, footer
  home.njk, projects.njk page bodies, written once for all languages
_includes/partials/
  contact-link.njk       contactLink macro: email / phone link from site.contact
fr/, nl/                 one stub per page, only picks its layout
index.njk                root fallback redirecting / to /fr/
eleventy.config.js       i18n plugin, `translate` and `asset_url` filters, `icon` shortcode, copied assets (fonts included)
_config/images.js        image pipeline: `picture` / `preloadPicture` shortcodes, download of remote images
scripts/deploy.sh        server-side build and atomic publish, run by the Deploy workflow
css/, js/, img/          copied as-is, except img/src
img/src/                 full-size photos (projects, skills/), processed at build time (not copied)
img/src/remote/          local copies of the remote (Unsplash) images, committed
```

## Translations

Templates call `{{ "key" | translate }}`; add `| safe` only when the text holds markup (e.g. `<strong>`).
The filter looks the key up in the page language's dictionary, then in `common.json`.
A key missing from both fails the build.

To add a text:

1. add the key to `_data/i18n/fr.json` and `_data/i18n/nl.json`, or once to `common.json` if it doesn't change between languages;
2. use it in the layout: `{{ "section.key" | translate }}`, including for `alt` and `aria-label` attributes.

Internal links go through `locale_url` so they stay in the current language: `{{ '/fr/projects/' | locale_url }}`.

To add a page, create its layout in `_includes/layouts/` (chained to `layouts/base.njk`) and a stub per language in `fr/` and `nl/`.

## Images

Every photo goes through `{% picture source, alt, options %}` (in `_config/images.js`, via [@11ty/eleventy-img](https://www.11ty.dev/docs/plugins/image/)), which renders a `<picture>` in webp with a jpeg fallback, written to `_site/img/<folder>/`.

- `source`: a file in `img/src/`, or a remote URL (the Unsplash placeholders). A remote image is downloaded into `img/src/remote/` the first time a build needs it, and never again once the file is there: commit it, so the server's builds never contact the remote site
- `options`: `folder` (output folder, required), `widths` (default `[400, 800, 1200]`), `ratio` (e.g. `[16, 9]`, center-crops the image), `sizes`, `class` (on `<picture>`), `lazy`, `priority` (`fetchpriority="high"`, for the hero)

The ratio is part of the output file names, so changing a crop renders new files.
`{% preloadPicture source, options %}` writes the `<link rel="preload">` of an above-the-fold picture; given the same options, it targets the same files (used for the hero, whose options are in the `hero` front matter of `home.njk`).

To add a project, drop its `<name>-before.jpg` and `<name>-after.jpg` originals in `img/src/` and add an entry to `projects` in `_includes/layouts/projects.njk`.

To add a service, add an entry to `_data/skills.json` (`image`: an Unsplash URL or a file in `img/src/skills/`; `icon`: see below) and its `skill.<id>` and `skill.<id>-alt` keys to every language file.

## Icons and fonts

Nothing is loaded from a third-party site.

- Icons: `{% icon "fa-house" %}` inlines the SVG of a [Font Awesome Free](https://fontawesome.com/search?ic=free&s=solid) solid icon (from `@fortawesome/free-solid-svg-icons`), sized and coloured like the surrounding text (`.icon` in `base.css`). An unknown name fails the build.
- Fonts: Fraunces and Urbanist (variable, latin subset) come from the `@fontsource-variable` packages; `eleventy.config.js` copies their woff2 files to `/fonts/`, `base.css` declares them with `@font-face` and `base.njk` preloads them. Another weight needs no change (the fonts are variable); italics, another subset or another family need their file added to the passthrough copy and a `@font-face`.

## Contact details

The email, phone and VAT number are in `site.contact` (`_data/site.json`); the header and the contact section render the links with the `contactLink` macro.

## Language switcher

Flags are `img/flags/<language code>.svg`; replace the files to change their design.

## Cache busting

Local CSS, JS and images are linked through the `asset_url` filter, which appends a hash of the file's content: `{{ '/css/base.css' | asset_url }}` renders `/css/base.css?v=<hash>`.
The URL changes only when the file does, so the server can cache these files for a year. A fragment is kept: `/img/house.svg?v=<hash>#segment`; a missing file fails the build.
Images rendered by `picture` already have a content hash in their file name.
Fonts in `/fonts/` are not versioned (`base.css` links them by a fixed URL): they are served by the `location /` below and revalidated on every visit.

Always link files from `css/`, `js/` and `img/` through `asset_url`: the server caches them for a year, so a link without the version could serve a stale file.

## Server

nginx serves the deploy's `current` symlink. Its security headers are in a snippet, `/etc/nginx/snippets/ecorenomax-headers.conf`:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

A `location` with its own `add_header` drops every `add_header` of the `server` block, so the snippet is included at both levels.
Main site, in `/etc/nginx/sites-available/` (the HTTP -> HTTPS and www redirects are unchanged):

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name ecorenomax.be;

    ssl_certificate /etc/letsencrypt/live/ecorenomax.be/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ecorenomax.be/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/ecorenomax/current;
    index index.html;

    include snippets/ecorenomax-headers.conf;

    # Hidden files; first regex location, so it wins over the assets one
    location ~ /\. {
        deny all;
    }

    # The generated _site/index.html also redirects, with a meta refresh
    location = / {
        return 301 /fr/;
    }

    # HTML: revalidated on every visit, so a deploy shows at once and pages point to the new asset URLs
    location / {
        include snippets/ecorenomax-headers.conf;
        add_header Cache-Control "no-cache";
        try_files $uri $uri/ =404;
    }

    # CSS, JS and images: versioned by asset_url (?v=<hash>) or named with a hash by eleventy-img
    location ~* ^/(css|js|img)/ {
        include snippets/ecorenomax-headers.conf;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
}
```

With `open_file_cache` enabled, nginx may serve the previous release for up to `open_file_cache_valid` (60s by default) after the `current` symlink changes.
