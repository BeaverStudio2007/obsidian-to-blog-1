const { DateTime } = require("luxon");
const fs = require("fs");
const slugify = require("slugify");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const pluginNavigation = require("@11ty/eleventy-navigation");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const Image = require('@11ty/eleventy-img');

module.exports = function(eleventyConfig) {

  // Passthrough files
  const files = [
    'src/Submark.ico',
    'fonts/CLONE-ROUNDED-LATN-ME-RG.woff2',
    // Добавляй сюда другие файлы/папки
  ];
  files.forEach(file => eleventyConfig.addPassthroughCopy(file));
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy("src/posts/img");
  

  // Plugins
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginNavigation);
 

  // Lazy images transform
  function lazyImages(eleventyConfig, userOptions = {}) {
    const { parse } = require('node-html-parser');
    const options = { name: 'lazy-images', ...userOptions };

    eleventyConfig.addTransform(options.name, (content, outputPath) => {
      if (!outputPath.endsWith('.html')) return content;

      const root = parse(content);
      const images = root.querySelectorAll('img');

      images.forEach(img => {
        img.setAttribute('loading', 'lazy');

        let src = img.getAttribute('src').replaceAll('%20', ' ');
        if (src.startsWith('i')) {
          const imageShortcode = (src, alt, widths) => {
            src = src.replaceAll('%20', ' ');
            let opts = {
              widths,
              formats: ["webp", "jpeg"],
              outputDir: "./_site/img/",
              filenameFormat: (id, src, width, format) => {
                return `${src.replace('src/posts/img/', '').replace(/\.(jpe?g)$/i,'').toLowerCase().replaceAll(' ','-')}-${width}.${format}`;
              }
            };

            Image(src, opts);
            let metadata = Image.statsSync(src, opts);
            return Image.generateHTML(metadata, {
              class: "image",
              alt,
              sizes: "(min-width: 832px) 800px, 100vw",
              loading: "lazy",
              decoding: "async",
            });
          };

          img.replaceWith(imageShortcode('src/posts/' + src, img.getAttribute('alt'), [716, 800, 1600]));
        }
      });

      return root.toString();
    });
  }

  eleventyConfig.addPlugin(lazyImages, {});

  // Layout alias
  eleventyConfig.addLayoutAlias("post", "layouts/post.njk");

  // Filters
  eleventyConfig.addFilter("readableDate", dateObj => DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat("dd LLL yyyy"));
  eleventyConfig.addFilter("htmlDateString", dateObj => DateTime.fromJSDate(dateObj, {zone: 'utc'}).toFormat('yyyy-LL-dd'));
  eleventyConfig.addFilter("head", (array, n) => {
    if(!Array.isArray(array) || array.length === 0) return [];
    return n < 0 ? array.slice(n) : array.slice(0, n);
  });
  eleventyConfig.addFilter("min", (...numbers) => Math.min(...numbers));

  const filterTagList = tags => (tags || []).filter(tag => !["all", "nav", "post", "posts"].includes(tag));
  eleventyConfig.addFilter("filterTagList", filterTagList);

  eleventyConfig.addCollection("tagList", collection => {
    let tagSet = new Set();
    collection.getAll().forEach(item => (item.data.tags || []).forEach(tag => tagSet.add(tag)));
    return filterTagList([...tagSet]);
  });

  // Markdown
  let markdownLibrary = markdownIt({ html: true, breaks: true, linkify: true });
  markdownLibrary.use(require('markdown-it-footnote'));
  markdownLibrary.use(require('markdown-it-attrs'));
  markdownLibrary.use(md => {
    md.linkify.add("[[", {
      validate: /^\s?([^\[\]\|\n\r]+)(\|[^\[\]\|\n\r]+)?\s?\]\]/,
      normalize: match => {
        const parts = match.raw.slice(2,-2).split("|");
        parts[0] = parts[0].replace(/\.(md|markdown)$/i, "");
        match.text = (parts[1] || parts[0]).trim();
        match.url = `/${slugify(parts[0], {lower: true})}/`;
      }
    });
  });
  markdownLibrary.use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: "after",
      class: "direct-link",
      symbol: "#",
      level: [1,2,3,4],
    }),
    slugify: eleventyConfig.getFilter("slug")
  });

  eleventyConfig.setLibrary("md", markdownLibrary);

  // Browsersync
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: function(err, browserSync) {
        const content_404 = fs.readFileSync('_site/404.html');
        browserSync.addMiddleware("*", (req, res) => {
          res.writeHead(404, {"Content-Type": "text/html; charset=UTF-8"});
          res.write(content_404);
          res.end();
        });
      },
    },
    ui: false,
    ghostMode: false
  });

  return {
    templateFormats: ["md","njk","html","liquid"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: "/",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};