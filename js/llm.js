/* ------------------------------------------------------------------
 * llm.js — OpenAI-কমপ্যাটিবল LLM API দিয়ে টপিক → ইনফরমেটিভ বাংলা
 * স্ক্রিপ্ট (JSON সিন) বানায়। ইউজারের নিজের API কী ব্যবহার হয়;
 * কী শুধু ব্রাউজারেই থাকে (localStorage), কোথাও পাঠানো হয় না।
 * ------------------------------------------------------------------ */
window.LLM = (function () {
  "use strict";

  var PROVIDERS = {
    openai: { label: "OpenAI", base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    deepseek: { label: "DeepSeek", base: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    groq: { label: "Groq", base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
    custom: { label: "কাস্টম (OpenAI-কমপ্যাটিবল)", base: "https://", model: "" },
  };

  function buildPrompt(topic, points) {
    var lines = [];
    lines.push(
      "তুমি একজন অভিজ্ঞ বাংলা ভিডিও স্ক্রিপ্ট রাইটার। বিষয়: " + topic
    );
    if (points && points.length) {
      lines.push(
        "ব্যবহারকারীর দেওয়া গুরুত্বপূর্ণ পয়েন্টগুলো (প্রতিটাকে আলাদা point সিন বানাও; caption আর spoken হিসেবে ওই পয়েন্টের কথাই ব্যবহার করো):"
      );
      points.forEach(function (p, i) { lines.push((i + 1) + ". " + p); });
    } else {
      lines.push("বিষয়টির গুরুত্বপূর্ণ, বাস্তব দিকগুলো নিয়ে ৪টি ভিন্ন ভিন্ন point সিন বানাও (যেমন: গুরুত্ব, প্রভাব, কারণ, উপকারিতা, ঝুঁকি, সমাধান, করণীয়, ভবিষ্যৎ)।");
    }
    lines.push(
      'শুধু নিচের JSON ফরম্যাটে সিনের অ্যারে দাও (কোনো অতিরিক্ত লেখা, মার্কডাউন বা ব্যাখ্যা নয়):',
      '[',
      ' {"type":"title","caption":"সংক্ষিপ্ত টাইটেল ক্যাপশন","spoken":"টাইটেল সিনের স্বাভাবিক বক্তব্য"},',
      ' {"type":"point","caption":"পয়েন্টের সংক্ষিপ্ত লেবেল","spoken":"এই পয়েন্ট নিয়ে ইনফরমেটিভ বক্তব্য"},',
      ' ... (মোট point সিন: ' + (points && points.length ? points.length : 4) + 'টা)',
      ' {"type":"reflect","caption":"সারমর্ম","spoken":"সারসংক্ষেপের বক্তব্য"},',
      ' {"type":"outro","caption":"সচেতন হোন • এগিয়ে যান","spoken":"আউটরো ও সাবস্ক্রাইব অনুরোধ"}',
      ']'
    );
    lines.push(
      "নিয়ম:",
      "- সব কনটেন্ট বাংলা বর্ণমালায়।",
      "- spoken কথ্য ও স্বাভাবিক; বিষয় সম্পর্কে সঠিক ও তথ্যভিত্তিক; মিথ্যা পরিসংখ্যান বানাবে না; 'বিশেষজ্ঞরা বলেন' জাতীয় অপ্রমাণিত দাবি এড়াও।",
      "- প্রতিটি spoken ৪০-৮০ অক্ষরের মধ্যে, caption ২৮ অক্ষরের মধ্যে।",
      "- প্রথম সিন type=title, শেষ সিন type=outro, আগে type=reflect — এই ক্রম ঠিক রাখো।",
      "- শুধু JSON।"
    );
    return lines.join("\n");
  }

  function extractJSON(text) {
    if (!text) return null;
    var t = String(text).trim();
    // মার্কডাউন ফেন্স সরাও
    t = t.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    var start = t.indexOf("[");
    var end = t.lastIndexOf("]");
    if (start !== -1 && end > start) {
      t = t.slice(start, end + 1);
    }
    try {
      return JSON.parse(t);
    } catch (e) {
      return null;
    }
  }

  function normalizeScenes(arr, topic) {
    if (!Array.isArray(arr) || arr.length < 4) return null;
    var out = [];
    arr.slice(0, 9).forEach(function (raw, i) {
      var spoken = String(raw.spoken || "").replace(/\s+/g, " ").trim();
      if (!spoken) return;
      if (spoken.length > 110) spoken = spoken.slice(0, 110).replace(/\s\S*$/, "");
      var caption = String(raw.caption || "").replace(/\s+/g, " ").trim();
      if (caption.length > 32) caption = caption.slice(0, 32).replace(/\s\S*$/, "");
      var type = /title|point|reflect|outro/.test(String(raw.type || "")) ? String(raw.type) : "point";
      out.push({ type: type, caption: caption, spoken: spoken });
    });
    if (!out.length) return null;
    out[0].type = "title";
    out[out.length - 1].type = "outro";
    // মাঝেরটায় reflect না থাকলে শেষে ঠিক আগে ঢুকিয়ে দাও
    if (out.length >= 4 && !out.some(function (s) { return s.type === "reflect"; })) {
      var r = {
        type: "reflect",
        caption: "সারমর্ম",
        spoken: "সংক্ষেপে, " + topic + " আমাদের জীবনকে নানাভাবে প্রভাবিত করে। মূল বিষয়গুলো মাথায় রাখলেই সচেতন থাকা সম্ভব।",
      };
      out.splice(out.length - 1, 0, r);
    }
    return out;
  }

  /**
   * generateScript(topic, cfg, opts) -> scenes | null
   * cfg: { baseUrl, model, apiKey }
   * opts: { points: [string] }
   * ব্যর্থ হলে null দেয় (কলার টেমপ্লেটে ফিরে যাবে)।
   */
  function generateScript(topic, cfg, opts) {
    opts = opts || {};
    if (!cfg || !cfg.apiKey) return Promise.resolve(null);
    var base = (cfg.baseUrl || "").replace(/\/+$/, "");
    if (!/^https:\/\//.test(base)) return Promise.resolve(null);
    var url = base + "/chat/completions";
    var model = cfg.model || "gpt-4o-mini";
    var points = (opts.points || []).map(function (p) { return p.replace(/\s+/g, " ").trim(); }).filter(Boolean);

    var body = {
      model: model,
      messages: [
        { role: "system", content: "তুমি শুধু বৈধ JSON আউটপুট দেবে, অন্য কিছু নয়।" },
        { role: "user", content: buildPrompt(topic, points) },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    };

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 90000);

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            throw new Error("HTTP " + res.status + " " + txt.slice(0, 200));
          });
        }
        return res.json();
      })
      .then(function (data) {
        var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        var parsed = extractJSON(content);
        var scenes = normalizeScenes(parsed, topic);
        if (!scenes) throw new Error("LLM থেকে বৈধ স্ক্রিপ্ট JSON পাওয়া যায়নি");
        return scenes;
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") throw new Error("LLM রিকোয়েস্ট টাইমআউট (৯০ সেকেন্ড)");
        throw err;
      })
      .finally(function () { clearTimeout(timer); });
  }

  /**
   * test(cfg) -> Promise<string> (মডেল নাম)
   * সংযোগ ও কী বৈধ কিনা যাচাই করে।
   */
  function test(cfg) {
    if (!cfg || !cfg.apiKey) return Promise.reject(new Error("API কী দেওয়া হয়নি"));
    var base = (cfg.baseUrl || "").replace(/\/+$/, "");
    if (!/^https:\/\//.test(base)) return Promise.reject(new Error("Base URL অবশ্যই https:// দিয়ে শুরু হবে"));
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(base + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify({
        model: cfg.model || "gpt-4o-mini",
        messages: [{ role: "user", content: "বাংলায় 'ঠিক আছে' লিখো" }],
        max_tokens: 10,
      }),
      signal: ctrl.signal,
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            throw new Error("HTTP " + res.status + " " + txt.slice(0, 160));
          });
        }
        return res.json();
      })
      .then(function (data) {
        return (data && data.model) || "সফল";
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") throw new Error("টাইমআউট (৩০ সেকেন্ড)");
        throw err;
      })
      .finally(function () { clearTimeout(timer); });
  }

  return { PROVIDERS: PROVIDERS, generateScript: generateScript, test: test, extractJSON: extractJSON, normalizeScenes: normalizeScenes };
})();
