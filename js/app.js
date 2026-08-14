/* ------------------------------------------------------------------
 * app.js — UI নিয়ন্ত্রণ: ভয়েস, থিম, LLM/ইমেজ API সেটিংস, জেনারেট,
 * প্রিভিউ, রেকর্ড, স্ক্রিপ্ট সম্পাদনা
 * ------------------------------------------------------------------ */
(function () {
  "use strict";

  var SET_KEY = "t2v_settings_v1";

  var stage = document.getElementById("stage");
  var topicInput = document.getElementById("topic");
  var pointsInput = document.getElementById("points");
  var voiceSelect = document.getElementById("voiceSelect");
  var generateBtn = document.getElementById("generateBtn");
  var playBtn = document.getElementById("playBtn");
  var recordBtn = document.getElementById("recordBtn");
  var stopBtn = document.getElementById("stopBtn");
  var statusEl = document.getElementById("status");
  var hintEl = document.getElementById("hint");
  var timeEl = document.getElementById("time");
  var scenePlan = document.getElementById("scenePlan");
  var withVoice = document.getElementById("withVoice");
  var themeRow = document.getElementById("themeRow");
  var saveScriptBtn = document.getElementById("saveScriptBtn");

  // সেটিংস এলিমেন্ট
  var llmOn = document.getElementById("llmOn");
  var llmProvider = document.getElementById("llmProvider");
  var llmBase = document.getElementById("llmBase");
  var llmModel = document.getElementById("llmModel");
  var llmKey = document.getElementById("llmKey");
  var llmTestBtn = document.getElementById("llmTestBtn");
  var llmTestResult = document.getElementById("llmTestResult");
  var imgOn = document.getElementById("imgOn");
  var imgProvider = document.getElementById("imgProvider");
  var imgKey = document.getElementById("imgKey");

  var scenes = null;
  var activeTheme = window.Artwork.THEMES.tealorange;
  var playing = false;

  window.Composer.init(stage);

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- সেটিংস (localStorage) ---------- */
  function currentSettings() {
    return {
      llmOn: llmOn.checked,
      llmProvider: llmProvider.value,
      llmBase: llmBase.value.trim(),
      llmModel: llmModel.value.trim(),
      llmKey: llmKey.value.trim(),
      imgOn: imgOn.checked,
      imgProvider: imgProvider.value,
      imgKey: imgKey.value.trim(),
    };
  }

  function saveSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(currentSettings())); } catch (e) { /* ignore */ }
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SET_KEY)) || {};
    } catch (e) { return {}; }
  }

  function applySettings(s) {
    llmOn.checked = !!s.llmOn;
    llmProvider.value = s.llmProvider || "openai";
    llmBase.value = s.llmBase || "";
    llmModel.value = s.llmModel || "";
    llmKey.value = s.llmKey || "";
    imgOn.checked = !!s.imgOn;
    imgProvider.value = s.imgProvider || "pixabay";
    imgKey.value = s.imgKey || "";
  }

  function fillProviderDefaults(provider) {
    var p = window.LLM.PROVIDERS[provider];
    if (!p) return;
    if (provider === "custom") return;
    llmBase.value = p.base;
    llmModel.value = p.model;
  }

  applySettings(loadSettings());

  llmProvider.addEventListener("change", function () {
    if (llmProvider.value === "custom") return;
    fillProviderDefaults(llmProvider.value);
  });

  document.querySelector(".settings").addEventListener("input", saveSettings);

  /* ---------- LLM টেস্ট ---------- */
  llmTestBtn.addEventListener("click", function () {
    var cfg = { baseUrl: llmBase.value.trim(), model: llmModel.value.trim(), apiKey: llmKey.value.trim() };
    if (!cfg.apiKey) {
      llmTestResult.textContent = "প্রথমে API কী দিন";
      llmTestResult.className = "set-test-result err";
      return;
    }
    llmTestResult.textContent = "যাচাই হচ্ছে…";
    llmTestResult.className = "set-test-result";
    window.LLM.test(cfg)
      .then(function (model) {
        llmTestResult.textContent = "✔ সংযোগ সফল (" + model + ")";
        llmTestResult.className = "set-test-result ok";
      })
      .catch(function (e) {
        llmTestResult.textContent = "✖ ব্যর্থ: " + (e && e.message ? e.message.slice(0, 90) : "অজানা ত্রুটি");
        llmTestResult.className = "set-test-result err";
      });
  });

  /* ---------- থিম ---------- */
  themeRow.addEventListener("click", function (e) {
    var btn = e.target.closest(".theme-btn");
    if (!btn) return;
    themeRow.querySelectorAll(".theme-btn").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    activeTheme = window.Artwork.THEMES[btn.dataset.theme];
  });

  /* ---------- ভয়েস তালিকা ---------- */
  function populateVoices() {
    if (!("speechSynthesis" in window)) {
      voiceSelect.innerHTML = "<option value=''>ভয়েস সাপোর্ট নেই</option>";
      return;
    }
    var voices = window.speechSynthesis.getVoices();
    var bn = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf("bn") === 0; });
    var others = voices.filter(function (v) { return bn.indexOf(v) === -1; });
    var options = ["<option value=''>অটো (ব্রাউজার ডিফল্ট)</option>"];
    bn.forEach(function (v) {
      options.push("<option value='" + v.voiceURI + "'>" + v.name + " · " + v.lang + "</option>");
    });
    if (bn.length) {
      var best = bn.filter(function (v) { return /naba|tanisha|pradeep|nabanita|bashkar|indra/i.test(v.name); });
      var pick = (best[0] || bn[0]).voiceURI;
      options[0] = "<option value='" + pick + "' selected>অটো · " + (best[0] || bn[0]).name + "</option>";
    }
    others.slice(0, 8).forEach(function (v) {
      options.push("<option value='" + v.voiceURI + "'>" + v.name + " · " + v.lang + "</option>");
    });
    voiceSelect.innerHTML = options.join("");
  }
  if ("speechSynthesis" in window) {
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  /* ---------- স্ক্রিপ্ট + সিন প্ল্যান UI ---------- */
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function typeName(t) {
    return { title: "টাইটেল", point: "মূল বিষয়", reflect: "সারমর্ম", outro: "আউটরো" }[t] || t;
  }

  function renderPlan() {
    var html = "";
    scenes.forEach(function (s, i) {
      var caption = s.heading || s.caption || s.title || "";
      var spokenEsc = s.spoken.replace(/"/g, "&quot;");
      html += "<div class='scene-card' data-i='" + i + "'>" +
        "<div class='scene-head'>" +
        "<span class='scene-idx'>" + (i + 1) + "</span>" +
        "<span class='scene-type'>" + typeName(s.type) + "</span>" +
        "<span class='scene-dur'>" + fmtTime(s.duration) + "</span>" +
        "<button class='btn btn-small scene-edit-btn'>✎</button>" +
        "</div>" +
        "<div class='scene-text'>" + caption + "</div>" +
        "<div class='scene-edit-box' hidden>" +
        "<textarea class='scene-spoken' rows='2'>" + spokenEsc + "</textarea>" +
        "</div>" +
        "</div>";
    });
    scenePlan.innerHTML = html;
    saveScriptBtn.disabled = true;
  }

  function parsePoints() {
    return (pointsInput.value || "").split("\n").map(function (p) { return p.trim(); }).filter(Boolean);
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (cls ? " " + cls : "");
  }

  function setBusy(msg) {
    statusEl.innerHTML = "<span class='spinner'></span>" + msg;
    statusEl.className = "status";
  }

  async function doGenerate() {
    var topic = window.ScriptGen.cleanTopic(topicInput.value);
    if (!topic) {
      setStatus("কেননা, আগে একটা টপিক লিখুন 😊", "err");
      return;
    }
    generateBtn.disabled = true;
    var points = parsePoints();
    var st = currentSettings();
    saveSettings();

    var scenesOut = null;
    var usedLLM = false;
    var llmSkipped = false;

    if (st.llmOn) {
      if (st.llmKey && st.llmBase) {
        setBusy("🧠 LLM থেকে স্ক্রিপ্ট আসছে…");
        try {
          scenesOut = await window.LLM.generateScript(
            topic,
            { baseUrl: st.llmBase, model: st.llmModel, apiKey: st.llmKey },
            { points: points }
          );
          usedLLM = true;
        } catch (e) {
          console.error("LLM error:", e && e.message);
          scenesOut = null;
        }
      } else {
        llmSkipped = true;
      }
    }

    if (!scenesOut) {
      setBusy(usedLLM ? "LLM ব্যর্থ — বিল্ট-ইন টেমপ্লেটে ফিরলাম…" : "স্ক্রিপ্ট তৈরি হচ্ছে…");
      await sleep(60);
      scenesOut = window.ScriptGen.generate(topic, { points: points });
    }
    if (!scenesOut) { generateBtn.disabled = false; return; }

    scenesOut[0].isTitle = true;
    scenesOut[scenesOut.length - 1].isTitle = true;

    var images = 0;
    if (st.imgOn && st.imgKey) {
      setBusy("🖼 স্টক ছবি খুঁজে লোড হচ্ছে…");
      await window.StockImages.loadIntoScenes(scenesOut, topic, { provider: st.imgProvider, key: st.imgKey });
      images = scenesOut.filter(function (s) { return s.image; }).length;
    }

    scenes = scenesOut;
    renderPlan();
    playBtn.disabled = false;
    recordBtn.disabled = false;

    var src = usedLLM ? "LLM থেকে" : (llmSkipped ? "টেমপ্লেট (LLM কী দেওয়া হয়নি)" : "টেমপ্লেট থেকে");
    var extra = "";
    if (points.length) extra += ", আপনার " + points.length + "টা পয়েন্ট সহ";
    if (images) extra += ", " + images + "টা ছবি";
    setStatus("✔ " + scenes.length + "টা সিন তৈরি হয়েছে (" + src + extra + ") — এখন প্রিভিউ বা রেকর্ড করুন।", "ok");
    hintEl.textContent = "ভয়েসের জন্য টপিকের ভয়েসওভার বাজবে। প্রিভিউতে কিছুক্ষণ লাগে।";
    generateBtn.disabled = false;
  }

  generateBtn.addEventListener("click", doGenerate);

  /* ---------- স্ক্রিপ্ট সম্পাদনা ---------- */
  scenePlan.addEventListener("click", function (e) {
    var btn = e.target.closest(".scene-edit-btn");
    if (!btn) return;
    var card = btn.closest(".scene-card");
    var box = card.querySelector(".scene-edit-box");
    var hidden = box.hidden;
    box.hidden = !hidden;
    btn.classList.toggle("on", hidden);
    if (hidden) box.querySelector("textarea").focus();
  });

  scenePlan.addEventListener("input", function (e) {
    if (!e.target.classList.contains("scene-spoken")) return;
    var card = e.target.closest(".scene-card");
    card.classList.add("dirty");
    saveScriptBtn.disabled = false;
  });

  saveScriptBtn.addEventListener("click", function () {
    if (!scenes) return;
    scenePlan.querySelectorAll(".scene-card").forEach(function (card) {
      var i = parseInt(card.dataset.i, 10);
      var sc = scenes[i];
      var val = card.querySelector(".scene-spoken").value;
      sc.spoken = val.replace(/\s+/g, " ").trim() || sc.spoken;
      sc.duration = window.ScriptGen.estimateDuration(sc.spoken);
    });
    var t = 0;
    scenes.forEach(function (s) { s.start = t; t += s.duration; });
    scenes.total = t;
    renderPlan();
    setStatus("✔ স্ক্রিপ্ট হালনাগাদ হয়েছে — নতুন সময়সূচি প্রস্তুত।", "ok");
  });

  /* ---------- প্লেব্যাক ---------- */
  function setPlaying(p) {
    playing = p;
    playBtn.disabled = p || !scenes;
    recordBtn.disabled = p || !scenes;
    stopBtn.disabled = !p;
  }

  function updateTime(frac) {
    if (!scenes) return;
    var total = scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration;
    timeEl.textContent = fmtTime(frac * total);
  }

  function downloadBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 4000);
  }

  function slug(name) {
    return (name || "video").trim().replace(/[^\w\u0980-\u09FF]+/g, "-").replace(/^-+|-+$/g, "") || "video";
  }

  playBtn.addEventListener("click", function () {
    if (!scenes) return;
    setPlaying(true);
    setStatus("▶ প্রিভিউ চলছে...");
    hintEl.textContent = "";
    document.fonts.ready.then(function () {
      window.Composer.play(scenes, {
        theme: activeTheme,
        voice: withVoice.checked,
        voiceURI: voiceSelect.value,
        record: false,
        onProgress: function (f) { updateTime(f); },
      }).then(function () {
        setPlaying(false);
        setStatus("প্রিভিউ শেষ। রেকর্ড করলে WebM ডাউনলোড পাবেন।");
      });
    });
  });

  recordBtn.addEventListener("click", function () {
    if (!scenes) return;
    if (withVoice.checked) {
      hintEl.textContent = "ভয়েসওভার যুক্ত করতে Chrome/Edge ট্যাব শেয়ার করুন (অডিও সহ)। স্ক্রিন নয়, 'এই ট্যাব' বেছে নিন।";
    } else {
      hintEl.textContent = "রেকর্ডিং চলছে — এই ট্যাবেই থাকুন।";
    }
    setPlaying(true);
    setStatus("● রেকর্ডিং চলছে... ভিডিও শেষ হলে ডাউনলোড শুরু হবে।");
    document.fonts.ready.then(function () {
      window.Composer.play(scenes, {
        theme: activeTheme,
        voice: withVoice.checked,
        voiceURI: voiceSelect.value,
        includeVoice: withVoice.checked,
        record: true,
        onProgress: function (f) { updateTime(f); },
      }).then(function (res) {
        setPlaying(false);
        if (res && res.blob) {
          downloadBlob(res.blob, slug(topicInput.value) + "-video.webm");
          setStatus("✔ ভিডিও ডাউনলোড শুরু হয়েছে (" + (res.blob.size / 1048576).toFixed(1) + " MB)।", "ok");
          hintEl.textContent = "WebM ফরম্যাট — GitHub, YouTube, Google Photos সব জায়গায় চলবে।";
        } else {
          setStatus("রেকর্ডিং বাতিল হয়েছে।");
        }
      });
    });
  });

  stopBtn.addEventListener("click", function () {
    window.Composer.stop();
  });

  topicInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") generateBtn.click();
  });
})();
