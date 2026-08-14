/* ------------------------------------------------------------------
 * composer.js — সিন টাইমলাইন প্লেব্যাক, Ken Burns মোশন, ক্রসফেড,
 * ক্যাপশন, ভয়েসওভার শিডিউলিং, MediaRecorder দিয়ে ভিডিও এক্সপোর্ট
 * ------------------------------------------------------------------ */
window.Composer = (function () {
  "use strict";

  var TR = 0.8;
  var FONT = '"Hind Siliguri","Noto Sans Bengali","SolaimanLipi",sans-serif';

  var canvas, ctx, W, H;
  var rafId = null;
  var running = false;
  var activeStop = null;
  var frameCtx = { noiseTile: makeNoiseTile(256) };

  function makeNoiseTile(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var img = g.createImageData(size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function init(stage) {
    canvas = stage;
    ctx = stage.getContext("2d");
    W = canvas.width;
    H = canvas.height;
  }

  function speak(text, voiceURI) {
    if (!("speechSynthesis" in window)) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "bn";
    if (voiceURI) {
      var voices = window.speechSynthesis.getVoices();
      var found = voices.filter(function (v) { return v.voiceURI === voiceURI; })[0];
      if (found) u.voice = found;
    }
    u.rate = 0.98;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }

  function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCaption(text, yRatio, size, isTitle) {
    if (!text) return;
    ctx.font = (isTitle ? "800 " : "600 ") + size + "px " + FONT;
    var tw = ctx.measureText(text).width;
    var cx = W / 2, cy = H * yRatio;
    var padX = size * 0.55, padY = size * 0.4;
    var x0 = cx - tw / 2 - padX, x1 = cx + tw / 2 + padX;
    var y0 = cy - size * 0.55, y1 = cy + size * 0.5;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    rounded(x0, y0, x1 - x0, y1 - y0, size * 0.5);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  function drawBadge(text, yRatio, size) {
    if (!text) return;
    ctx.font = "700 " + size + "px " + FONT;
    var tw = ctx.measureText(text).width;
    var cx = W / 2, cy = H * yRatio;
    var padX = size * 0.9, padY = size * 0.5;
    var x0 = cx - tw / 2 - padX, x1 = cx + tw / 2 + padX;
    var y0 = cy - size * 0.9, y1 = cy + size * 0.8;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    rounded(x0, y0, x1 - x0, y1 - y0, (y1 - y0) / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  function drawImageCover(img, W, H) {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    var scale = Math.max(W / iw, H / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  function renderScene(scene, t, alpha, theme, rng) {
    var a = window.Artwork;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Ken Burns
    var mode = scene.idx % 4;
    var z = 1, panX = 0, panY = 0;
    if (mode === 0) z = 1 + 0.1 * t;
    else if (mode === 1) z = 1.1 - 0.1 * t;
    else if (mode === 2) { z = 1.1; panX = -0.05 * W * t; }
    else { z = 1.1; panX = -0.05 * W * (1 - t); }
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2 - panX, -H / 2 - panY);
    var img = scene.image;
    if (img && img.complete && img.naturalWidth) {
      drawImageCover(img, W, H);
      // ক্যাপশন পড়ার সুবিধার্থে হালকা ডার্ক ওভারলে
      ctx.fillStyle = "rgba(4,7,14,0.38)";
      ctx.fillRect(0, 0, W, H);
    } else {
      a.paint(scene.art, ctx, W, H, t, theme, rng);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    a.grade(ctx, W, H, theme, rng, frameCtx);
    if (scene.isTitle) {
      drawCaption(scene.title, 0.36, Math.round(H * 0.085), true);
      drawCaption(scene.caption, 0.475, Math.round(H * 0.038), false);
    } else {
      if (scene.heading) drawBadge(scene.heading, 0.14, Math.round(H * 0.036));
      drawCaption(scene.caption, 0.82, Math.round(H * 0.042), false);
    }
    ctx.restore();
  }

  function currentScene(scenes, clock) {
    for (var i = scenes.length - 1; i >= 0; i--) {
      if (clock >= scenes[i].start) return i;
    }
    return 0;
  }

  /**
   * play(scenes, options) -> Promise<{blob?} | null>
   * options: { theme, voice (bool), voiceURI, includeVoice (bool), record (bool),
   *           onProgress, onReady }
   */
  function play(scenes, options) {
    return new Promise(function (resolveMain) {
      if (!canvas || !scenes || !scenes.length) return resolveMain(null);
      var theme = options.theme;
      var total = scenes[scenes.length - 1].start + scenes[scenes.length - 1].duration;

      scenes.forEach(function (sc, i) {
        sc.idx = i;
        sc.rng = window.Artwork.makeRng(1000 + i * 77);
      });

      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var bgmDest = audioCtx.createMediaStreamDestination();
      var playbackGain = audioCtx.createGain();
      playbackGain.gain.value = 0.85;
      playbackGain.connect(audioCtx.destination);
      var bgmOut = window.BGM.start(audioCtx, bgmDest, scenes, audioCtx.currentTime + 0.15);
      bgmOut.connect(playbackGain);

      // ---- রেকর্ডিং সেটআপ ----
      var recStream = null;
      var recorder = null;
      var recChunks = [];
      var recBlob = null;
      var displayAudioTrack = null;

      function ensureRecStream() {
        if (recStream) return recStream;
        recStream = new MediaStream(canvas.captureStream(30));
        recStream.addTrack(bgmDest.stream.getAudioTracks()[0]);
        return recStream;
      }

      function setupRecorder() {
        return new Promise(function (res) {
          if (!options.record) return res();
          try {
            var mime = "video/webm;codecs=vp9";
            if (!window.MediaRecorder || !window.MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
            recorder = new MediaRecorder(ensureRecStream(), { mimeType: mime, videoBitsPerSecond: 8e6 });
          } catch (e) {
            recorder = new MediaRecorder(ensureRecStream(), { mimeType: "video/webm" });
          }
          recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) recChunks.push(ev.data); };
          recorder.onstop = function () {
            recBlob = new Blob(recChunks, { type: "video/webm" });
          };
          recorder.start(200);
          res();
        });
      }

      function askTabAudio() {
        return new Promise(function (res) {
          if (!options.record || !options.includeVoice) return res();
          if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return res();
          var settled = false;
          var finish = function () { if (!settled) { settled = true; res(); } };
          setTimeout(finish, 5000); // ট্যাব শেয়ার প্রম্পটে আটকে গেলে এগিয়ে যাই
          navigator.mediaDevices
            .getDisplayMedia({ video: { width: 640, height: 360 }, audio: true })
            .then(function (ds) {
              displayAudioTrack = ds.getAudioTracks()[0];
              if (displayAudioTrack) ensureRecStream().addTrack(displayAudioTrack);
              ds.getVideoTracks().forEach(function (tr) { tr.stop(); });
              finish();
            })
            .catch(function () { finish(); });
        });
      }

      // ---- প্লেব্যাক লুপ ----
      var clock0 = 0;
      var spoken = {};
      var stopped = false;

      function frame(now) {
        if (stopped) return;
        var clock = (now - clock0) / 1000;
        if (clock >= total + 0.2) { finish(); return; }

        var i = currentScene(scenes, clock);
        var sc = scenes[i];

        if (options.voice !== false && !spoken[i]) {
          spoken[i] = true;
          if (sc.spoken) speak(sc.spoken, options.voiceURI);
        }

        ctx.clearRect(0, 0, W, H);
        var lt = Math.max(0, Math.min(1, (clock - sc.start) / sc.duration));
        if (clock >= sc.start) renderScene(sc, lt, 1, theme, sc.rng);

        var endT = sc.start + sc.duration;
        if (i < scenes.length - 1 && clock > endT - TR) {
          var next = scenes[i + 1];
          var a = Math.max(0, Math.min(1, (clock - (endT - TR)) / TR));
          var nt = Math.max(0, Math.min(1, (clock - next.start) / next.duration));
          renderScene(next, nt, a, theme, next.rng);
        }

        if (options.onProgress) options.onProgress(Math.min(1, clock / total));
        rafId = requestAnimationFrame(frame);
      }

      function finish() {
        if (stopped) return;
        stopped = true;
        if (rafId) cancelAnimationFrame(rafId);
        try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }

        var waitForRec = Promise.resolve();
        if (recorder && recorder.state !== "inactive") {
          waitForRec = new Promise(function (r) {
            recorder.onstop = function () {
              recBlob = new Blob(recChunks, { type: "video/webm" });
              r();
            };
            recorder.stop();
          });
        }
        waitForRec.then(function () {
          if (displayAudioTrack) displayAudioTrack.stop();
          if (recStream) recStream.getTracks().forEach(function (tr) { tr.stop(); });
          audioCtx.close().catch(function () {});
          if (options.onProgress) options.onProgress(1);
          resolveMain(options.record ? { blob: recBlob } : null);
        });
      }

      activeStop = finish;

      askTabAudio().then(setupRecorder).then(function () {
        if (stopped) return;
        clock0 = performance.now();
        rafId = requestAnimationFrame(frame);
      });
    });
  }

  function stop() {
    if (activeStop) {
      var f = activeStop;
      activeStop = null;
      f();
    }
  }

  return { init: init, play: play, stop: stop };
})();
