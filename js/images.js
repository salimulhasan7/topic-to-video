/* ------------------------------------------------------------------
 * images.js — Pixabay / Pexels স্টক ইমেজ API দিয়ে প্রতিটা সিনের জন্য
 * রিয়েল ছবি খুঁজে লোড করে। ইউজারের নিজের API কী ব্যবহার হয়।
 * crossOrigin=anonymous দিয়ে লোড হয় যাতে ক্যানভাস দূষিত না হয়;
 * CORS ব্যর্থ হলে ছবি বাদ — জেনারেটিভ আর্টওয়ার্কই থাকবে।
 * ------------------------------------------------------------------ */
window.StockImages = (function () {
  "use strict";

  var MAX_IMAGES = 6;

  function providerQuery(provider, key, query, perPage) {
    if (provider === "pexels") {
      return {
        url: "https://api.pexels.com/v1/search?query=" + encodeURIComponent(query) + "&per_page=" + perPage +
          "&orientation=landscape",
        headers: { "Authorization": key },
      };
    }
    // Pixabay (ডিফল্ট)
    return {
      url: "https://pixabay.com/api/?key=" + encodeURIComponent(key) + "&q=" + encodeURIComponent(query) +
        "&per_page=" + perPage + "&image_type=photo&orientation=horizontal&min_width=1280&safesearch=true" +
        "&lang=" + (/[\u0980-\u09FF]/.test(query) ? "bn" : "en"),
      headers: {},
    };
  }

  function pickURLs(json, provider, perPage) {
    var urls = [];
    if (provider === "pexels") {
      var photos = (json && json.photos) || [];
      photos.slice(0, perPage).forEach(function (ph) {
        if (ph && ph.src && (ph.src.large2x || ph.src.large || ph.src.original)) {
          urls.push(ph.src.large2x || ph.src.large || ph.src.original);
        }
      });
    } else {
      var hits = (json && json.hits) || [];
      hits.slice(0, perPage).forEach(function (h) {
        if (h && h.webformatURL) urls.push(h.webformatURL);
      });
    }
    return urls;
  }

  function search(provider, key, query, perPage) {
    var req = providerQuery(provider, key, query, perPage || 3);
    return fetch(req.url, { headers: req.headers }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (json) {
      return pickURLs(json, provider, perPage || 3);
    });
  }

  function loadImage(url) {
    return new Promise(function (res) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = url;
    });
  }

  function pickTopicFor(topic, scene) {
    // পয়েন্টের ক্যাপশন যোগ করলে সার্চ আরও নির্দিষ্ট হয়
    var parts = [topic];
    if (scene.caption && scene.type === "point" && scene.caption.length > 2 && scene.caption.length < 40) {
      parts.push(scene.caption);
    }
    return parts.join(" ").slice(0, 80);
  }

  /**
   * loadIntoScenes(scenes, topic, cfg) -> Promise<void>
   * cfg: { provider, key }
   * সফল হলে scene.image = HTMLImageElement; ব্যর্থ হলে scene.image = null।
   */
  function loadIntoScenes(scenes, topic, cfg) {
    if (!cfg || !cfg.key || !scenes || !scenes.length) return Promise.resolve();
    var provider = cfg.provider === "pexels" ? "pexels" : "pixabay";
    var targets = scenes.slice(0, MAX_IMAGES);
    return Promise.all(
      targets.map(function (sc) {
        return search(provider, cfg.key, pickTopicFor(topic, sc), 3)
          .then(function (urls) {
            if (!urls.length) { sc.image = null; return; }
            // প্রথমটা ব্যর্থ হলে পরেরটা চেষ্টা
            return urls.reduce(function (chain, u) {
              return chain.then(function (img) { return img || loadImage(u); });
            }, Promise.resolve(null)).then(function (img) { sc.image = img || null; });
          })
          .catch(function () { sc.image = null; });
      })
    );
  }

  return { search: search, loadImage: loadImage, loadIntoScenes: loadIntoScenes, pickTopicFor: pickTopicFor };
})();
