(() => {
  "use strict";

  const canvas = document.getElementById("birthdayCanvas");
  const ctx = canvas.getContext("2d");
  const messageEl = document.getElementById("message");
  const soundToggle = document.getElementById("soundToggle");
  const soundLabel = document.getElementById("soundLabel");
  const musicHint = document.getElementById("musicHint");

  // Coordinate and composition are based on the original Python Turtle artwork.
  const TILT = -0.45;
  const MESSAGE = "Happy Birthday Cilvy";
  const STAR_COUNT = 1000;
  const GALAXY_COUNT = 24000;
  const NEBULA_COUNT = 2400;
  const STAR_DURATION = 7.0;
  const GALAXY_START = 7.4;
  const GALAXY_DURATION = 18.0;
  const TEXT_START = GALAXY_START + GALAXY_DURATION + 1.5;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let audioContext = null;
  let musicTimer = null;
  let musicOn = false;
  let messageStarted = false;

  // Reproducible random numbers, similar to random.seed(7) in Python.
  const random = (() => {
    let seed = 7;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  })();

  const rand = (min, max) => min + random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  function gaussian(mean = 0, deviation = 1) {
    const u = Math.max(random(), 1e-10);
    const v = random();
    return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  let stars = [];
  let galaxy = [];
  let centerDust = [];
  let nebula = [];
  let startedAt = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildScene() {
    stars = [];
    galaxy = [];
    centerDust = [];
    nebula = [];

    // Layered white and cool-colored stars, with different brightness levels.
    for (let i = 0; i < STAR_COUNT; i++) {
      const bright = random() > 0.84;
      stars.push({
        x: random(), y: random(),
        radius: bright ? rand(1.35, 2.45) : rand(0.65, 1.5),
        twinkle: rand(0.48, 1), phase: rand(0, Math.PI * 2),
        hue: rand(0.53, 0.70), bright, appear: i / STAR_COUNT
      });
    }

    // Layered nebula clouds: irregular, overlapping clouds rather than a perfect ring.
    for (let i = 0; i < NEBULA_COUNT; i++) {
      const a = rand(0, Math.PI * 2);
      const cloud = random();
      const r = Math.sqrt(random()) * 330;
      nebula.push({
        x: Math.cos(a) * r * 1.16 + gaussian(0, cloud > 0.72 ? 38 : 22),
        y: Math.sin(a) * r * 0.78 + gaussian(0, cloud > 0.72 ? 30 : 18),
        radius: rand(0.7, cloud > 0.8 ? 3.1 : 1.9),
        hue: random() > 0.5 ? rand(0.68, 0.84) : rand(0.88, 0.99),
        alpha: rand(0.035, 0.17), phase: rand(0, Math.PI * 2),
        appear: rand(0.03, 0.92)
      });
    }

    // Five uneven spiral arms. Density, width and curvature vary to avoid a rigid pinwheel.
    const armCount = 5;
    const armOffsets = Array.from({ length: armCount }, (_, i) =>
      (i / armCount) * Math.PI * 2 + gaussian(0, 0.12)
    );
    for (let i = 0; i < GALAXY_COUNT; i++) {
      const arm = i % armCount;
      const step = Math.floor(i / armCount);
      const progress = step / Math.ceil(GALAXY_COUNT / armCount);
      const spread = 5 + progress * 18;
      const radius = 9 + Math.pow(progress, 0.78) * 302
        + gaussian(0, spread)
        + Math.sin(progress * 17 + arm * 1.7) * 5;
      const winding = progress * (Math.PI * 2.05 + arm * 0.035);
      const angle = armOffsets[arm] + winding
        + Math.sin(progress * 8 + arm) * 0.10
        + gaussian(0, 0.11 + progress * 0.035);

      // A small fraction of particles drift into the inter-arm dust lanes.
      const diffuse = random() > 0.84;
      const drift = diffuse ? gaussian(0, 22) : gaussian(0, 5.5);
      const x = radius * Math.cos(angle) + Math.cos(angle + Math.PI / 2) * drift;
      const y = radius * Math.sin(angle) + Math.sin(angle + Math.PI / 2) * drift;

      const roll = progress + rand(-0.16, 0.16);
      let hue;
      if (roll < 0.24) hue = rand(0.035, 0.13);
      else if (roll < 0.49) hue = rand(0.91, 0.99);
      else if (roll < 0.77) hue = rand(0.69, 0.85);
      else hue = rand(0.55, 0.69);

      galaxy.push({
        x: x + gaussian(0, diffuse ? 8 : 3.2),
        y: y + gaussian(0, diffuse ? 8 : 3.2),
        radius: diffuse ? rand(0.55, 1.45) : rand(0.75, 2.0),
        hue, value: rand(0.68, 1),
        phase: rand(0, Math.PI * 2),
        bright: random() > 0.975,
        appear: i / GALAXY_COUNT + rand(0, 0.0015)
      });
    }

    // Fine, low-density cosmic dust fills the gaps and softens the spiral silhouette.
    for (let i = 0; i < 1800; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(random()) * 315;
      galaxy.push({
        x: Math.cos(a) * r * 1.05 + gaussian(0, 12),
        y: Math.sin(a) * r * 0.72 + gaussian(0, 11),
        radius: rand(0.35, 0.95),
        hue: random() > 0.5 ? rand(0.66, 0.82) : rand(0.9, 0.99),
        value: rand(0.35, 0.72),
        phase: rand(0, Math.PI * 2),
        bright: false,
        appear: random()
      });
    }

    // Dense warm central cluster.
    for (let i = 0; i < 1500; i++) {
      const r = Math.abs(gaussian(0, 34));
      const a = rand(0, Math.PI * 2);
      centerDust.push({
        x: r * Math.cos(a), y: r * Math.sin(a),
        radius: rand(0.65, 2.2), phase: rand(0, Math.PI * 2),
        appear: 0.58 + (i / 1500) * 0.42
      });
    }
  }

  function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  function color(h, v, alpha = 1) {
    const [r, g, b] = hsvToRgb(((h % 1) + 1) % 1, 0.7, v);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function screenPoint(x, y) {
    const flattenedY = y * 0.55;
    const c = Math.cos(TILT);
    const s = Math.sin(TILT);
    const rotatedX = x * c - flattenedY * s;
    const rotatedY = x * s + flattenedY * c;
    const scale = Math.min(width / 780, height / 480);
    return {
      x: width / 2 + rotatedX * scale,
      y: height / 2 - rotatedY * scale,
      scale
    };
  }

  function dot(x, y, radius, fill, glow = 0) {
    const p = screenPoint(x, y);
    ctx.save();
    if (glow) {
      ctx.shadowBlur = glow * p.scale;
      ctx.shadowColor = fill;
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.45, radius * p.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
  }

  function drawShootingStar(elapsed) {
    // Meteor streak travels diagonally across the entire screen, on both portrait and landscape.
    const cycle = 7.2;
    const local = elapsed % cycle;
    if (local > 1.35) return;

    const t = local / 1.35;
    const x = width * (-0.12 + t * 1.24);
    const y = height * (0.08 + t * 0.48);
    const tailX = x - Math.min(width, height) * 0.12;
    const tailY = y - Math.min(width, height) * 0.055;

    ctx.save();
    const gradient = ctx.createLinearGradient(x, y, tailX, tailY);
    gradient.addColorStop(0, "rgba(255,255,255,0.98)");
    gradient.addColorStop(0.25, "rgba(190,210,255,0.58)");
    gradient.addColorStop(1, "rgba(160,190,255,0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(1.2, Math.min(2.2, width / 420));
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#b8caff";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFullScreenStars(elapsed, visibleCount) {
    // Normalized coordinates distribute stars over the complete viewport.
    for (let i = 0; i < visibleCount; i++) {
      const p = stars[i];
      const x = p.x * width;
      const y = p.y * height;
      const wave = 0.5 + 0.5 * Math.sin(elapsed * (1.25 + p.twinkle * 2.3) + p.phase);
      const pulse = 0.28 + wave * 0.72;
      const radius = p.radius * (p.bright ? 1.0 : 0.82);

      ctx.beginPath();
      ctx.fillStyle = p.bright
        ? color(p.hue, 1, 0.42 + pulse * 0.58)
        : `rgba(225,232,255,${0.24 + pulse * 0.68})`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.bright) {
        ctx.save();
        ctx.globalAlpha = 0.18 + pulse * 0.42;
        ctx.shadowBlur = 8 + pulse * 8;
        ctx.shadowColor = "#c9d8ff";
        ctx.fillStyle = "#dce7ff";
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (pulse > 0.84) {
          const arm = 2.5 + pulse * 3.5;
          ctx.save();
          ctx.strokeStyle = `rgba(225,235,255,${0.35 + pulse * 0.5})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }


  function drawGalaxyBatch(count, progress, elapsed) {
    // Batch particles by hue: far fewer canvas state changes than one save/restore per dot.
    const buckets = Array.from({ length: 36 }, () => []);
    const complete = progress >= 1;

    for (let i = 0; i < count; i++) {
      const p = galaxy[i];
      if (!complete && progress < p.appear) continue;

      const fade = complete
        ? 1
        : easeOut(Math.max(0, Math.min(1, (progress - p.appear) * 210)));
      const pulse = 0.72 + 0.28 * Math.sin(elapsed * 1.9 + p.phase);
      const pos = screenPoint(p.x * fade, p.y * fade);
      const hueIndex = Math.min(35, Math.floor((((p.hue % 1) + 1) % 1) * 36));
      buckets[hueIndex].push({
        x: pos.x, y: pos.y,
        r: Math.max(0.45, p.radius * pos.scale),
        alpha: fade * pulse * p.value
      });
    }

    for (let b = 0; b < buckets.length; b++) {
      const points = buckets[b];
      if (!points.length) continue;
      const hue = b / 36;
      ctx.beginPath();
      for (const p of points) {
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = color(hue, 0.95, 0.88);
      ctx.fill();
    }

    // Draw only the brightest stars with glow, keeping the overall effect luminous but efficient.
    if (complete) {
      for (let i = 0; i < count; i += 1) {
        const p = galaxy[i];
        if (!p.bright) continue;
        const q = screenPoint(p.x, p.y);
        const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 2.4 + p.phase));
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 7;
        ctx.shadowColor = color(p.hue, 1);
        ctx.fillStyle = "#fff2df";
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.8, p.radius * q.scale * 1.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function render(now) {
    const elapsed = (now - startedAt) / 1000;
    ctx.clearRect(0, 0, width, height);

    const center = screenPoint(0, 0);
    const scale = Math.min(width / 780, height / 480);
    const haze = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, 270 * scale);
    haze.addColorStop(0, "rgba(48,32,82,0.16)");
    haze.addColorStop(0.55, "rgba(24,18,48,0.055)");
    haze.addColorStop(1, "rgba(3,3,6,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);

    // Stage 1: reveal stars across the complete viewport.
    const starProgress = Math.min(1, elapsed / STAR_DURATION);
    const visibleStars = Math.floor(starProgress * STAR_COUNT);
    drawFullScreenStars(elapsed, visibleStars);

    drawShootingStar(elapsed);

    // Stage 2: a soft nebula appears, then spiral particles assemble one by one.
    const galaxyElapsed = elapsed - GALAXY_START;
    if (galaxyElapsed > 0) {
      const progress = Math.min(1, galaxyElapsed / GALAXY_DURATION);

      for (const p of nebula) {
        if (progress >= p.appear) {
          const fade = easeOut(Math.min(1, (progress - p.appear) * 4));
          const twinkle = 0.75 + 0.25 * Math.sin(elapsed * 1.3 + p.phase);
          dot(p.x, p.y, p.radius, color(p.hue, 0.95, p.alpha * fade * twinkle), 2);
        }
      }

      drawGalaxyBatch(galaxy.length, progress, elapsed);

      // Golden central dust blooms toward the end.
      for (const p of centerDust) {
        if (progress >= p.appear) {
          const fade = easeOut(Math.min(1, (progress - p.appear) * 26));
          const twinkle = 0.72 + 0.28 * Math.sin(elapsed * 2.4 + p.phase);
          dot(p.x, p.y, p.radius, color(0.09, 1, fade * twinkle), 7);
        }
      }

      // Soft luminous core.
      const coreGlow = Math.max(0, Math.min(1, (progress - 0.72) / 0.28));
      if (coreGlow > 0) {
        const q = screenPoint(0, 0);
        const radius = (24 + 44 * coreGlow) * scale;
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, radius);
        g.addColorStop(0, `rgba(255,218,160,${0.24 * coreGlow})`);
        g.addColorStop(0.35, `rgba(255,125,105,${0.11 * coreGlow})`);
        g.addColorStop(1, "rgba(100,80,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Once formed, selected particles sparkle continuously.
      if (progress >= 1) {
        for (let i = 0; i < 48; i++) {
          const p = galaxy[(i * 41) % galaxy.length];
          const q = screenPoint(p.x, p.y);
          const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * 2.6 + p.phase));
          ctx.save();
          ctx.strokeStyle = `rgba(255,245,255,${pulse * 0.7})`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#e4caff";
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(q.x - 3.5, q.y); ctx.lineTo(q.x + 3.5, q.y);
          ctx.moveTo(q.x, q.y - 3.5); ctx.lineTo(q.x, q.y + 3.5);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    if (elapsed >= TEXT_START && !messageStarted) {
      messageStarted = true;
      typeMessage();
    }
    requestAnimationFrame(render);
  }

  function typeMessage() {
    let index = 0;
    const typeNext = () => {
      if (index < MESSAGE.length) {
        messageEl.textContent += MESSAGE[index++];
        window.setTimeout(typeNext, 150);
      }
    };
    typeNext();
  }

  // A small synthesized birthday melody; no MP3 or external asset is needed.
  const melody = [
    [392.00, .32], [392.00, .32], [440.00, .64], [392.00, .64],
    [523.25, .64], [493.88, 1.0], [392.00, .32], [392.00, .32],
    [440.00, .64], [392.00, .64], [587.33, .64], [523.25, 1.0],
    [392.00, .32], [392.00, .32], [783.99, .64], [659.25, .64],
    [523.25, .64], [493.88, .64], [440.00, 1.0],
    [698.46, .32], [698.46, .32], [659.25, .64], [523.25, .64],
    [587.33, .64], [523.25, 1.0]
  ];

  function playNote(freq, duration, start) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.11, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.88);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function scheduleMelody() {
    if (!musicOn || !audioContext) return;
    let cursor = audioContext.currentTime + 0.04;
    const total = melody.reduce((sum, item) => sum + item[1], 0);
    for (const [freq, duration] of melody) {
      playNote(freq, duration, cursor);
      cursor += duration;
    }
    musicTimer = window.setTimeout(scheduleMelody, total * 1000);
  }

  async function toggleMusic() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        musicHint.textContent = "Browser ini belum mendukung audio.";
        return;
      }
      if (!audioContext) audioContext = new AudioContextClass();

      if (musicOn) {
        musicOn = false;
        window.clearTimeout(musicTimer);
        await audioContext.suspend();
        soundLabel.textContent = "Tap for music";
        soundToggle.setAttribute("aria-label", "Turn birthday music on");
        musicHint.textContent = "Music paused";
      } else {
        await audioContext.resume();
        musicOn = true;
        scheduleMelody();
        soundLabel.textContent = "Music on";
        soundToggle.setAttribute("aria-label", "Turn birthday music off");
        musicHint.textContent = "Enjoy the celebration ♡";
      }
    } catch {
      musicHint.textContent = "Ketuk tombol musik sekali lagi untuk mengaktifkan suara.";
    }
  }

  soundToggle.addEventListener("click", toggleMusic);
  window.addEventListener("resize", resize);

  resize();
  buildScene();
  requestAnimationFrame(render);
})();
