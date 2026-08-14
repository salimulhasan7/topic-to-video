/* ------------------------------------------------------------------
 * scriptgen.js — টপিক থেকে পয়েন্ট-ভিত্তিক ইনফরমেটিভ বাংলা স্ক্রিপ্ট
 * তৈরি করে। টপিক-হ্যাশ থেকে নির্ধারিত অ্যাঙ্গেল (গুরুত্ব, প্রভাব,
 * উপকারিতা, চ্যালেঞ্জ, করণীয়, ভবিষ্যৎ) দিয়ে প্রতিটি "মূল বিষয়"
 * সিন তৈরি হয়। ব্যবহারকারী নিজের পয়েন্ট দিলে সেগুলোই সিন হয়।
 * ------------------------------------------------------------------ */
window.ScriptGen = (function () {
  "use strict";

  // আনুমানিক কথা বলার গতি: প্রতি সেকেন্ডে ~6 বর্ণ (বাংলা বক্তৃতার গড়)
  function estimateDuration(text) {
    var n = (text || "").length;
    return Math.max(4.5, Math.min(9, n / 6.0));
  }

  function cleanTopic(raw) {
    var t = (raw || "").trim();
    if (!t) return null;
    t = t.replace(/\s+/g, " ");
    if (t.length > 60) t = t.slice(0, 60).replace(/\s\S*$/, "");
    return t;
  }

  // ডিটারমিনিস্টিক হ্যাশ + PRNG → একই টপিকে সবসময় একই স্ক্রিপ্ট
  function hashString(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  /* ---------- অ্যাঙ্গেল টেমপ্লেট ---------- */
  // প্রতিটি অ্যাঙ্গেল: { title, bank } — bank এর প্রতিটি ফাংশন টপিক থেকে বাক্য বানায়
  var ANGLES = [
    {
      title: "কেন গুরুত্বপূর্ণ",
      bank: [
        function (T) {
          return "কেন " + T + " এত গুরুত্বপূর্ণ? কারণ এটি আমাদের চিন্তা, আচরণ আর দৈনন্দিন সিদ্ধান্তকে সরাসরি প্রভাবিত করে।";
        },
        function (T) {
          return T + " এমন একটি বিষয়, যা উপেক্ষা করা যায় না। এর গুরুত্ব বোঝা মানেই নিজের জীবনকে আরও সচেতনভাবে গড়ে তোলা।";
        },
        function (T) {
          return "বিশেষজ্ঞদের মতে, " + T + " সম্পর্কে সঠিক ধারণা রাখা এখন আগের চেয়ে বেশি জরুরি — কারণ এর প্রভাব পড়ছে আমাদের সবচেয়ে সাধারণ কাজগুলোতেও।";
        },
      ],
    },
    {
      title: "কীভাবে প্রভাব ফেলে",
      bank: [
        function (T) {
          return T + " শুধু একজনের নয়, পুরো সমাজের জীবনকেই বদলে দিতে পারে — অভ্যাস, সম্পর্ক আর পছন্দ, সবকিছুতেই এর ছাপ থাকে।";
        },
        function (T) {
          return "দীর্ঘমেয়াদে " + T + " আমাদের শারীরিক ও মানসিক স্বাস্থ্য, উৎপাদনশীলতা আর সম্পর্ক — সবকিছুকে প্রভাবিত করে।";
        },
        function (T) {
          return T + " এর প্রভাব একদিনে বোঝা যায় না, তবে ধীরে ধীরে এটি আমাদের রুটিন আর জীবনযাত্রার অংশ হয়ে যায়।";
        },
      ],
    },
    {
      title: "উপকারিতা",
      bank: [
        function (T) {
          return "সঠিকভাবে ব্যবহার করলে " + T + " অনেক সুবিধা দেয় — সময় বাঁচায়, দক্ষতা বাড়ায় আর নতুন সুযোগের দরজা খুলে দেয়।";
        },
        function (T) {
          return T + " এর ইতিবাচক দিকগুলো কাজে লাগাতে পারলে ব্যক্তিগত ও পেশাগত জীবন, দুই-ই এগিয়ে যায়।";
        },
        function (T) {
          return "অনেক মানুষই জানেন না, " + T + " সঠিকভাবে ব্যবহার করলে কীভাবে উপকার মেলে। একটু সচেতনতাই এখানে বড় পরিবর্তন আনতে পারে।";
        },
      ],
    },
    {
      title: "চ্যালেঞ্জ ও ঝুঁকি",
      bank: [
        function (T) {
          return "তবে এর বিপরীত দিকটাও আছে — " + T + " এর অতিরিক্ত বা ভুল ব্যবহার অনেক ঝুঁকি তৈরি করতে পারে।";
        },
        function (T) {
          return T + " নিয়ে সবচেয়ে বড় চ্যালেঞ্জ হলো তথ্যের সঠিক ভারসাম্য রাখা — অতিরিক্ত মাত্রা যেমন ক্ষতি করে, তেমনি সম্পূর্ণ এড়িয়ে চলাও সমাধান নয়।";
        },
        function (T) {
          return "সচেতনতা ছাড়া " + T + " দ্রুত নিয়ন্ত্রণের বাইরে চলে যেতে পারে। তাই ঝুঁকিগুলো আগে থেকে জেনে রাখা খুবই জরুরি।";
        },
      ],
    },
    {
      title: "করণীয়",
      bank: [
        function (T) {
          return "তাহলে করণীয় কী? শুরু করুন ছোট করে — " + T + " সম্পর্কে বিশ্বস্ত উৎস থেকে পড়ুন, মাঝে মাঝে যাচাই করুন, আর নিজের অভিজ্ঞতা দিয়ে বুঝুন।";
        },
        function (T) {
          return T + " নিয়ে সচেতন হতে হলে দরকার নিয়মিত অনুশীলন আর খোলা মন। জানুন, বোঝুন, আর প্রয়োগ করুন।";
        },
        function (T) {
          return "যেকোনো সিদ্ধান্ত নেওয়ার আগে " + T + " সম্পর্কে ভালোভাবে জেনে নেওয়াই বুদ্ধিমানের কাজ — তথ্য যত বেশি, ভুলের সম্ভাবনা তত কম।";
        },
      ],
    },
    {
      title: "ভবিষ্যৎ",
      bank: [
        function (T) {
          return "ভবিষ্যতে " + T + " আরও বেশি গুরুত্বপূর্ণ হয়ে উঠবে। যারা আজ প্রস্তুতি নেবে, তারাই সামনের চ্যালেঞ্জগুলো ভালোভাবে সামলাতে পারবে।";
        },
        function (T) {
          return "বিশেষজ্ঞদের ধারণা, আগামী দিনগুলোতে " + T + " নিয়ে আলোচনা আরও বাড়বে — কারণ এর সঙ্গে জড়িয়ে আছে আমাদের ভবিষ্যৎ।";
        },
        function (T) {
          return T + " কেমন হবে ভবিষ্যতে, সেটা অনেকটাই নির্ভর করছে আজ আমরা কী শিখছি আর কীভাবে তা কাজে লাগাচ্ছি, তার ওপর।";
        },
      ],
    },
    {
      title: "বাস্তবতা",
      bank: [
        function (T) {
          return "একটি মজার তথ্য — " + T + " নিয়ে মানুষের আগ্রহ দিন দিন বাড়ছে, আর গবেষণাও প্রমাণ করছে এর গুরুত্ব।";
        },
        function (T) {
          return T + " নিয়ে আমরা যতই ভিন্নমতের হই, একটি বিষয়ে সবাই একমত — এটা সবার জীবনেরই অংশ হয়ে গেছে।";
        },
        function (T) {
          return "বাস্তবতা হলো, " + T + " আজ আর ঐচ্ছিক কিছু নয় — এটিকে বুঝতে না পারলে পিছিয়ে থাকার ঝুঁকি থেকেই যায়।";
        },
      ],
    },
  ];

  var INTROS = [
    function (T) {
      return "আজ আমরা কথা বলব " + T + " নিয়ে। এমন একটি বিষয়, যা আমাদের সবার জীবনকে স্পর্শ করে। চলুন, মূল বিষয়গুলো জেনে নিই।";
    },
    function (T) {
      return T + " — এই বিষয়টি নিয়েই আজকের আলোচনা। একটু ভাবুন তো, এই একটি বিষয় কীভাবে আপনার দৈনন্দিন জীবনকে বদলে দেয়? চলুন জানি।";
    },
    function (T) {
      return "আজকের ভিডিওতে আমরা আলোচনা করব " + T + " নিয়ে। একদম শুরু থেকে, সহজভাবে — মূল বিষয়গুলো বুঝে নেওয়ার চেষ্টা করব।";
    },
  ];

  var SUMMARIES = [
    function (T, n) {
      return "সংক্ষেপে বলতে গেলে, " + T + " আমাদের জীবনকে নানাভাবে ছুঁয়ে থাকে। আলোচনা করা " + n + "টা মূল বিষয় মাথায় রাখলেই সচেতন থাকা সম্ভব।";
    },
    function (T) {
      return "এতক্ষণ যা আলোচনা করলাম, তার সারমর্ম হলো — " + T + " সম্পর্কে সচেতন থাকাই সবচেয়ে বড় শক্তি।";
    },
    function (T) {
      return "মূল কথা হলো, " + T + " নিয়ে চিন্তা করা, জানা আর প্রয়োগ করা — এই তিনটিই আমাদের সামনে এগিয়ে নিয়ে যায়।";
    },
  ];

  var OUTROS = [
    function (T) {
      return T + " নিয়ে আপনার মতামত কী? কমেন্টে জানান। ভিডিওটি ভালো লাগলে লাইক, শেয়ার আর সাবস্ক্রাইব করুন। সচেতন হোন, এগিয়ে যান।";
    },
    function (T) {
      return "আশা করি " + T + " নিয়ে এই আলোচনা কাজে লাগবে। কমেন্টে আপনার অভিজ্ঞতা জানান — লাইক, শেয়ার আর সাবস্ক্রাইব করতে ভুলবেন না।";
    },
    function (T) {
      return T + " সম্পর্কে জানতে আমাদের চ্যানেলে আরও ভিডিও আছে। এটিকে লাইক, শেয়ার আর সাবস্ক্রাইব করে আমাদের পাশে থাকুন।";
    },
  ];

  function buildPointScenes(rng, T, points) {
    var list = [];
    if (points && points.length) {
      // ব্যবহারকারীর দেওয়া পয়েন্টগুলোই সিন হয়
      points.forEach(function (pt, i) {
        list.push({
          type: "point",
          art: "notify",
          heading: "মূল বিষয় " + (i + 1),
          caption: (pt.length > 32 ? pt.slice(0, 32) + "…" : pt),
          spoken: pt,
        });
      });
      return list;
    }
    // ৭টা অ্যাঙ্গেল থেকে ডিটারমিনিস্টিকভাবে ৪টা বাছাই
    var order = ANGLES.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    var arts = ["silhouettes", "streak", "notify", "night"];
    order.slice(0, 4).forEach(function (idx, k) {
      var angle = ANGLES[idx];
      var speak = pick(rng, angle.bank)(T);
      list.push({
        type: "point",
        art: arts[k],
        heading: "মূল বিষয় " + (k + 1),
        caption: angle.title,
        spoken: speak,
      });
    });
    return list;
  }

  /**
   * generate(topic, opts) -> scenes | null
   * opts: { points: [string] } — নিজের পয়েন্ট (প্রতি লাইন একটা)
   */
  function generate(topicRaw, opts) {
    var T = cleanTopic(topicRaw);
    if (!T) return null;
    opts = opts || {};
    var rng = mulberry32(hashString(T));
    var points = (opts.points || []).map(function (p) {
      return p.replace(/\s+/g, " ").trim();
    }).filter(function (p) { return p; }).slice(0, 6);

    var scenes = [];

    scenes.push({
      type: "title",
      art: "hook",
      title: T,
      caption: "একটি চিন্তা-উদ্দীপক আলোচনা",
      spoken: pick(rng, INTROS)(T),
    });

    var pointScenes = buildPointScenes(rng, T, points);
    scenes = scenes.concat(pointScenes);

    var reflectArt = points.length ? "sunrise" : "night";
    scenes.push({
      type: "reflect",
      art: reflectArt,
      heading: "",
      caption: "সারমর্ম",
      spoken: pick(rng, SUMMARIES)(T, pointScenes.length),
    });

    scenes.push({
      type: "outro",
      art: "sunrise",
      heading: "",
      caption: "সচেতন হোন • এগিয়ে যান",
      spoken: pick(rng, OUTROS)(T),
    });

    var t = 0;
    scenes.forEach(function (s) {
      s.duration = estimateDuration(s.spoken);
      s.start = t;
      t += s.duration;
    });
    scenes.total = t;

    return scenes;
  }

  return { generate: generate, cleanTopic: cleanTopic, estimateDuration: estimateDuration };
})();
