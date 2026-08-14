/* ------------------------------------------------------------------
 * bgm.js — Web Audio API দিয়ে সিনেমাটিক অ্যাম্বিয়েন্ট BGM সিন্থেসাইজ
 * প্যাড কর্ড (Am-F-C-G), আরপেজিও, হার্টবিট পালস, শিমার নয়েজ
 * ------------------------------------------------------------------ */
window.BGM = (function () {
  "use strict";

  var CHORDS = [
    [220.0, 261.63, 329.63],   // Am
    [174.61, 220.0, 261.63],   // F
    [196.0, 246.94, 329.63],   // C
    [196.0, 246.94, 293.66],   // G
  ];

  function osc(ctx, type, freq, at, dur, peak, dest) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    // আক্রমণ/রিলিজ এনভেলপ
    var a = Math.min(0.4, dur * 0.25);
    var r = Math.min(1.2, dur * 0.4);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(peak, at + a);
    g.gain.setValueAtTime(peak, at + Math.max(a, dur - r));
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + dur + 0.1);
  }

  function pluck(ctx, freq, at, peak, dest) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + 1.7);
  }

  function thump(ctx, freq, at, peak, dest) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + 0.3);
  }

  function makeShimmer(ctx, at, dur, dest) {
    var n = ctx.sampleRate * dur;
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.02, at);
    var lfo = ctx.createOscillator();
    var lfoG = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoG.gain.value = 0.012;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    src.connect(lp);
    lp.connect(g);
    g.connect(dest);
    src.start(at);
    lfo.start(at);
    lfo.stop(at + dur + 0.5);
  }

  /**
   * start(ctx, dest, scenes, when) — টাইমলাইন অনুযায়ী সব মিউজিক শিডিউল করে
   * scenes: প্রতিটিতে {start, duration}
   */
  function start(ctx, dest, scenes, when) {
    var total = scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration;
    var t0 = when;

    // সাব ড্রোন
    [[55, 0.28], [82.41, 0.16]].forEach(function (pair) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = pair[0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(pair[1], t0 + 3);
      var lfo = ctx.createOscillator();
      var lfoG = ctx.createGain();
      lfo.frequency.value = 0.05;
      lfoG.gain.value = pair[1] * 0.4;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      o.connect(g);
      g.connect(dest);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + total + 1);
      lfo.stop(t0 + total + 1);
    });

    // শিমার
    makeShimmer(ctx, t0, total + 2, dest);

    scenes.forEach(function (sc, i) {
      var s = t0 + sc.start;
      var d = sc.duration;
      var chord = CHORDS[i % 4];
      // প্যাড
      chord.forEach(function (f) {
        osc(ctx, "sine", f * 2, s, d, 0.05, dest);
        osc(ctx, "sine", f * 2 * 1.004, s, d, 0.04, dest);
        osc(ctx, "sine", f, s, d, 0.03, dest);
      });
      // আরপেজিও
      var seq = [chord[0] * 4, chord[1] * 4, chord[2] * 4, chord[1] * 4, chord[0] * 4, chord[2] * 4];
      var step = d / 6;
      seq.forEach(function (f, k) {
        pluck(ctx, f, s + k * step, 0.11, dest);
        pluck(ctx, f, s + k * step + 0.09, 0.06, dest);
      });
      // হার্টবিট (মাঝের সিনগুলোতে)
      if (i >= 2 && i <= 4) {
        var beats = Math.floor(d * 0.85 / 0.95);
        for (var b = 0; b < beats; b++) {
          thump(ctx, 48, s + b * 0.95, 0.13, dest);
          thump(ctx, 48, s + b * 0.95 + 0.28, 0.08, dest);
        }
      }
    });

    // শেষে ফেড আউট
    var master = ctx.createGain();
    master.gain.setValueAtTime(1, t0);
    master.gain.setValueAtTime(1, t0 + total - 2.5);
    master.gain.linearRampToValueAtTime(0.0001, t0 + total);
    return master;
  }

  return { start: start, CHORDS: CHORDS };
})();
