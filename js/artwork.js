/* ------------------------------------------------------------------
 * artwork.js — canvas-এ জেনারেটিভ সিনেমাটিক আর্টওয়ার্ক
 * প্রতিটি সিন পেইন্টার (ctx, W, H, t, theme, rng) দিয়ে আঁকে।
 * t = সিনের লোকাল টাইম [0,1]
 * ------------------------------------------------------------------ */
window.Artwork = (function () {
  "use strict";

  // seeded PRNG (mulberry32) — প্রতি সিনে আলাদা বীজ
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var THEMES = {
    tealorange: {
      top: [10, 22, 44], bottom: [3, 7, 16],
      glow: [120, 185, 255], glow2: [90, 150, 235],
      warm: [255, 170, 105], teal: 0.12, orange: 0.10,
      sil: [6, 9, 16],
    },
    sunset: {
      top: [46, 18, 28], bottom: [14, 5, 12],
      glow: [255, 160, 100], glow2: [230, 120, 150],
      warm: [255, 190, 130], teal: 0.05, orange: 0.22,
      sil: [12, 6, 8],
    },
    midnight: {
      top: [14, 24, 54], bottom: [4, 7, 22],
      glow: [130, 150, 255], glow2: [90, 110, 230],
      warm: [180, 160, 255], teal: 0.16, orange: 0.08,
      sil: [5, 7, 14],
    },
    forest: {
      top: [12, 34, 24], bottom: [4, 11, 8],
      glow: [130, 230, 180], glow2: [90, 200, 160],
      warm: [200, 240, 210], teal: 0.18, orange: 0.05,
      sil: [4, 8, 6],
    },
  };

  /* ---------- low-level helpers ---------- */

  function rr(v) { return Math.round(v); }

  function linGrad(ctx, W, H, c1, c2, angleDeg) {
    var a = (angleDeg * Math.PI) / 180;
    var dx = Math.sin(a), dy = Math.cos(a);
    var g = ctx.createLinearGradient(-dx * W * 0.6, H + dy * W * 0.6, W + dx * W * 0.6, -dy * W * 0.6);
    g.addColorStop(0, "rgba(" + c1.join(",") + ",1)");
    g.addColorStop(1, "rgba(" + c2.join(",") + ",1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function radialGlow(ctx, x, y, r, color, alpha, falloff) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(" + color.join(",") + "," + alpha + ")");
    g.addColorStop(1, "rgba(" + color.join(",") + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function bokeh(ctx, W, H, n, palette, rng, blurCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < n; i++) {
      var x = rng() * W, y = rng() * H;
      var r = 6 + rng() * 28;
      var c = palette[Math.floor(rng() * palette.length)];
      ctx.globalAlpha = 0.1 + rng() * 0.16;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + c.join(",") + ",0.6)";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(ctx, x, baseY, hr, color) {
    ctx.save();
    ctx.fillStyle = "rgb(" + color.join(",") + ")";
    // মাথা
    var hy = baseY - hr * 2.2;
    ctx.beginPath();
    ctx.arc(x, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    // শরীর (কাঁধ)
    ctx.beginPath();
    ctx.moveTo(x - hr * 2.4, baseY);
    ctx.lineTo(x - hr * 1.6, hy + hr * 1.4);
    ctx.lineTo(x + hr * 1.6, hy + hr * 1.4);
    ctx.lineTo(x + hr * 2.4, baseY);
    ctx.closePath();
    ctx.fill();
    // পা
    ctx.fillRect(x - hr * 1.7, baseY - hr * 1.4, hr * 3.4, hr * 2.6);
    ctx.restore();
  }

  function drawPhone(ctx, x, y, w, h, screenPaint, rot, frame) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    var b = Math.round(w * 0.06);
    // ফ্রেম
    rounded(ctx, -w / 2, -h / 2, w, h, Math.round(w * 0.12));
    ctx.fillStyle = "rgb(" + frame + ")";
    ctx.fill();
    // স্ক্রিন
    rounded(ctx, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, Math.round(w * 0.08));
    if (screenPaint) screenPaint(ctx, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b);
    ctx.restore();
  }

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function feedCards(ctx, x, y, w, h, palette, n, rng) {
    ctx.save();
    for (var k = 0; k < n; k++) {
      var cw = (0.35 + rng() * 0.45) * w;
      var chh = (h / n) * (0.5 + rng() * 0.35);
      var cx = x + rng() * (w - cw);
      var cy = y + (h * k) / n + (h / n - chh) * rng();
      var col = palette[Math.floor(rng() * palette.length)];
      ctx.fillStyle = "rgb(" + col.join(",") + ")";
      rounded(ctx, cx, cy, cw, chh, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- scene painters ---------- */

  // 1. হুক: অন্ধকার ঘর + ফোনের আলো + মানুষ
  function paintHook(ctx, W, H, t, theme, rng) {
    linGrad(ctx, W, H, theme.top, theme.bottom, 15);
    // ফোনের ভলিউমেট্রিক আলো
    var px = W * 0.42, py = H * 0.62;
    radialGlow(ctx, px, py, W * 0.42, theme.glow, 0.5, 2.2);
    radialGlow(ctx, px, py, W * 0.18, [220, 235, 255], 0.7, 2.0);
    // ফোন
    drawPhone(ctx, px, py, W * 0.22, H * 0.62, function (c, x, y, w, h) {
      feedCards(c, x, y, w, h, [theme.glow, theme.glow2, [140, 190, 255]], 5, rng);
    }, -5, "8,11,18");
    // মানুষ
    drawPerson(ctx, W * 0.68, H * 0.82, H * 0.07, theme.sil);
    bokeh(ctx, W, H, 22, [theme.glow, theme.glow2], rng);
  }

  // 2. স্ট্রিক: নিচে পড়তে থাকা ফিডের আলোর রেখা
  function paintStreak(ctx, W, H, t, theme, rng) {
    linGrad(ctx, W, H, theme.bottom, theme.top, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 120; i++) {
      var x = rng() * W;
      var y0 = rng() * H - ((t * H * 0.4) % (H + 300));
      var len = 120 + rng() * 300;
      var wdt = 1 + Math.floor(rng() * 3);
      var c = [[70, 120, 220], [120, 160, 255], [180, 210, 255], theme.glow][Math.floor(rng() * 4)];
      ctx.globalAlpha = 0.15 + rng() * 0.3;
      ctx.strokeStyle = "rgb(" + c.join(",") + ")";
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + len);
      ctx.stroke();
    }
    ctx.restore();
    bokeh(ctx, W, H, 10, [theme.glow, theme.glow2], rng);
  }

  // 3. দুটি মানুষ পিঠে-পিঠি + মাঝে ঠান্ডা আলো
  function paintSilhouettes(ctx, W, H, t, theme, rng) {
    linGrad(ctx, W, H, [theme.top[0] + 6, theme.top[1] + 4, theme.top[2] + 8], theme.bottom, 30);
    radialGlow(ctx, W / 2, H * 0.66, W * 0.32, theme.glow, 0.35, 2.4);
    drawPerson(ctx, W * 0.3, H * 0.8, H * 0.065, theme.sil);
    drawPerson(ctx, W * 0.7, H * 0.8, H * 0.065, theme.sil);
    bokeh(ctx, W, H, 14, [theme.glow, theme.glow2], rng);
  }

  // 4. নোটিফিকেশন / ডোপামিন
  function paintNotify(ctx, W, H, t, theme, rng) {
    linGrad(ctx, W, H, [theme.top[0] + 12, theme.top[1] - 2, theme.top[2] - 6], theme.bottom, 0);
    radialGlow(ctx, W / 2, H / 2, W * 0.55, theme.warm, 0.28, 2.0);
    var icons = [[0.22, 0.3], [0.8, 0.3], [0.42, 0.2], [0.58, 0.48], [0.3, 0.58], [0.72, 0.68], [0.5, 0.76]];
    icons.forEach(function (p, i) {
      var ix = W * p[0], iy = H * p[1];
      var r = (30 + (i % 3) * 8) * (W / 1280);
      ctx.save();
      ctx.strokeStyle = "rgba(255,150,80,0.8)";
      ctx.lineWidth = 5;
      rounded(ctx, ix - r, iy - r, r * 2, r * 2, 12);
      ctx.stroke();
      // হৃদয়
      var s = r / 34;
      ctx.fillStyle = "rgba(255,90,90,0.9)";
      ctx.beginPath();
      ctx.moveTo(ix, iy + 14 * s);
      ctx.bezierCurveTo(ix - 22 * s, iy - 6 * s, ix - 10 * s, iy - 22 * s, ix, iy - 10 * s);
      ctx.bezierCurveTo(ix + 10 * s, iy - 22 * s, ix + 22 * s, iy - 6 * s, ix, iy + 14 * s);
      ctx.fill();
      ctx.restore();
    });
    // ঝরে পড়া হৃদয়
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var k = 0; k < 14; k++) {
      var hx = rng() * W;
      var hy = ((rng() * H - t * H * 0.3) % (H + 200));
      var hs = 0.5 + rng() * 0.8;
      ctx.fillStyle = "rgba(255," + Math.floor(90 + rng() * 80) + ",80,0.5)";
      ctx.beginPath();
      ctx.moveTo(hx, hy + 12 * hs);
      ctx.bezierCurveTo(hx - 20 * hs, hy - 4 * hs, hx - 8 * hs, hy - 18 * hs, hx, hy - 8 * hs);
      ctx.bezierCurveTo(hx + 8 * hs, hy - 18 * hs, hx + 20 * hs, hy - 4 * hs, hx, hy + 12 * hs);
      ctx.fill();
    }
    ctx.restore();
  }

  // 5. রাত: চাঁদ + ছড়ানো আলো (ঘুমহীন)
  function paintNight(ctx, W, H, t, theme, rng) {
    linGrad(ctx, W, H, theme.bottom, [theme.top[0] + 8, theme.top[1] + 8, theme.top[2] + 20], 35);
    radialGlow(ctx, W * 0.75, H * 0.2, H * 0.28, [210, 220, 240], 0.9, 2.0);
    radialGlow(ctx, W * 0.75, H * 0.2, H * 0.1, [240, 245, 255], 1.0, 2.0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 46; i++) {
      radialGlow(ctx, rng() * W, rng() * H, 10 + rng() * 30, theme.glow, 0.25, 2.0);
    }
    ctx.restore();
  }

  // 6. সূর্যোদয় / আশা
  function paintSunrise(ctx, W, H, t, theme, rng) {
    linGrad(ctx, W, H, [theme.top[0] + 16, theme.top[1] + 2, theme.top[2] - 4], theme.bottom, -20);
    var horizon = H * 0.62;
    radialGlow(ctx, W / 2, horizon, W * 0.5, theme.warm, 0.6, 2.2);
    // রশ্মি
    ctx.save();
    for (var a = 0; a < 360; a += 10) {
      var rad = (a * Math.PI) / 180;
      ctx.strokeStyle = "rgba(255,220,170,0.06)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2, horizon);
      ctx.lineTo(W / 2 + Math.cos(rad) * W, horizon + Math.sin(rad) * W);
      ctx.stroke();
    }
    ctx.restore();
    // গাছ
    ctx.save();
    ctx.fillStyle = "rgb(" + theme.sil.join(",") + ")";
    ctx.fillRect(W / 2 - 20, H * 0.5, 40, H * 0.5);
    [[-0.14, 0.4, 0.11], [0.08, 0.35, 0.13], [0.2, 0.44, 0.09], [-0.02, 0.32, 0.12], [0.13, 0.44, 0.08]].forEach(function (b) {
      ctx.beginPath();
      ctx.arc(W / 2 + b[0] * W, H * b[1], H * b[2], 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- finalize: কালার গ্রেডিং + ভিনিয়েট + গ্রেইন ---------- */

  function grade(ctx, W, H, theme, rng, frame) {
    // teal ছায়া / orange আলো
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    var g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, "rgba(0," + Math.floor(40 * theme.teal * 6) + "," + Math.floor(120 * theme.teal * 6) + ",0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var g2 = ctx.createLinearGradient(0, 0, W, H);
    g2.addColorStop(0, "rgba(255," + Math.floor(120 * theme.orange * 6) + "," + Math.floor(40 * theme.orange * 6) + ",0.4)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ভিনিয়েট
    ctx.save();
    var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ফিল্ম গ্রেইন
    if (frame.noiseTile) {
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.globalCompositeOperation = "overlay";
      var ox = Math.floor(rng() * frame.noiseTile.width);
      var oy = Math.floor(rng() * frame.noiseTile.height);
      ctx.drawImage(frame.noiseTile, -ox, -oy);
      ctx.restore();
    }
  }

  var painters = {
    hook: paintHook,
    streak: paintStreak,
    silhouettes: paintSilhouettes,
    notify: paintNotify,
    night: paintNight,
    sunrise: paintSunrise,
  };

  return {
    THEMES: THEMES,
    makeRng: makeRng,
    paint: function (style, ctx, W, H, t, theme, rng) {
      (painters[style] || paintHook)(ctx, W, H, t, theme, rng);
    },
    grade: grade,
    linGrad: linGrad,
    radialGlow: radialGlow,
    rounded: rounded,
    drawPerson: drawPerson,
    drawPhone: drawPhone,
  };
})();
