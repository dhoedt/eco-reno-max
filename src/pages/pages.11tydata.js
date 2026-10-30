// Pages are written from the site root, without the pages/ folder: src/pages/fr/projects.njk -> /fr/projects/
export default {
  permalink: (data) => `${data.page.filePathStem.replace(/^\/pages/, "").replace(/\/index$/, "")}/index.html`,
};
