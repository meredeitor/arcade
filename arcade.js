(() => {
  const canvas = document.getElementById("arcadeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = ["Sin enfoque", "Torbellino", "Metas vagas", "Sin tablero", "Sin cadencia", "Sin compromiso"];
  const teamMeta = {
    red: { name: "ROJO", main: "#ff3b4f", accent: "#ffd166", glow: "rgba(255,59,79,0.55)" },
    blue: { name: "AZUL", main: "#3aa0ff", accent: "#7df9ff", glow: "rgba(58,160,255,0.55)" },
  };

  const scene = {
    state: null,
    lastPower: { red: 0, blue: 0 },
    lastPhase: "lobby",
    lastQuestion: -1,
    lastWallHits: 0,
    flash: 0,
    shake: 0,
    hitStop: 0,
    banner: null,
    winnerPulse: null,
    particles: [],
    rubble: [],
    shockwaves: [],
    beams: [],
    t: 0,
  };

  function fit() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function banner(text, subtext, life = 1.4) {
    scene.banner = { text, subtext, life, max: life };
  }

  function onState(next) {
    const previous = scene.state;
    scene.state = next;

    if (next.phase === "question" && (scene.lastPhase !== "question" || scene.lastQuestion !== next.current)) {
      banner(`ROUND ${next.current + 1}`, next.questions[next.current]?.discipline || "4DX", 1.25);
      scene.shake = Math.max(scene.shake, 5);
    }

    if (next.power.red > scene.lastPower.red) powerBurst("red", next.power.red);
    if (next.power.blue > scene.lastPower.blue) powerBurst("blue", next.power.blue);

    if ((next.wallHits || 0) > scene.lastWallHits) {
      wallDamage(next.wallHits || 0, next.lastRound?.winner || "red");
    }

    if (previous && previous.phase !== "result" && next.phase === "result" && next.lastRound?.winner) {
      roundHit(next.lastRound.winner);
    }

    if (previous && previous.phase !== "final" && next.phase === "final") {
      finalBreak(next.winner || "red");
    }

    if (next.phase === "lobby" && scene.lastPhase !== "lobby") {
      scene.rubble = [];
      scene.particles = [];
      scene.shockwaves = [];
      scene.beams = [];
      scene.flash = 0;
      scene.shake = 0;
      scene.hitStop = 0;
      scene.winnerPulse = null;
      banner("4DX POWER CLASH", "Elige equipo y preparate", 1.7);
    }

    scene.lastPower = { ...next.power };
    scene.lastWallHits = next.wallHits || 0;
    scene.lastPhase = next.phase;
    scene.lastQuestion = next.current;
  }


  function wallBlockRect(index, w, h) {
    const bw = Math.min(170, w * 0.17);
    const bh = 58;
    const gap = 10;
    const startX = w * 0.5 - bw - gap * 0.5;
    const startY = h * 0.41;
    const col = index % 2;
    const row = Math.floor(index / 2);
    return { x: startX + col * (bw + gap), y: startY + row * (bh + gap), w: bw, h: bh };
  }

  function wallDamage(hitCount, team) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const blockIndex = Math.min(labels.length - 1, Math.floor((hitCount - 1) / 2));
    const rect = wallBlockRect(blockIndex, w, h);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const meta = teamMeta[team] || teamMeta.red;
    const breaking = hitCount % 2 === 0;

    scene.shake = Math.max(scene.shake, breaking ? 24 : 13);
    scene.flash = Math.max(scene.flash, breaking ? 0.55 : 0.25);
    scene.shockwaves.push({ x: cx, y: cy, r: breaking ? 34 : 20, life: 0.75, max: 0.75, color: meta.accent });
    banner(breaking ? "BARRIER BREAK" : "CRACK!", labels[blockIndex], breaking ? 1.05 : 0.72);

    if (breaking) {
      for (let i = 0; i < 16; i += 1) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
        const s = 180 + Math.random() * 430;
        scene.rubble.push({
          x: rect.x + Math.random() * rect.w,
          y: rect.y + Math.random() * rect.h,
          w: rect.w * (0.12 + Math.random() * 0.2),
          h: rect.h * (0.18 + Math.random() * 0.26),
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 80,
          rot: Math.random() * Math.PI,
          vr: -7 + Math.random() * 14,
          label: i === 0 ? labels[blockIndex] : "",
          life: 1.8,
        });
      }
    }

    for (let i = 0; i < (breaking ? 60 : 28); i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * (breaking ? 520 : 260);
      scene.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 90,
        life: 0.45 + Math.random() * 0.75,
        max: 1.1,
        color: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? meta.accent : meta.main,
        size: 3 + Math.random() * 7,
        kind: i % 5 === 0 ? "star" : "spark",
      });
    }
  }
  function powerBurst(team, power) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const x = team === "red" ? w * 0.24 : w * 0.76;
    const y = h * 0.66;
    const meta = teamMeta[team];
    scene.flash = Math.max(scene.flash, 0.28);
    scene.shake = Math.max(scene.shake, power >= 8 ? 13 : 7);
    scene.shockwaves.push({ x, y, r: 24, life: 0.75, max: 0.75, color: meta.accent });
    banner(power >= 10 ? "SUPER LISTO" : `POWER ${power}/10`, meta.name, power >= 10 ? 1.25 : 0.8);

    const count = power >= 8 ? 70 : 42;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 110 + Math.random() * (power >= 8 ? 410 : 260);
      scene.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 105,
        life: 0.75 + Math.random() * 0.55,
        max: 1.25,
        color: i % 4 === 0 ? meta.accent : meta.main,
        size: 3 + Math.random() * (power >= 8 ? 8 : 5),
        kind: i % 5 === 0 ? "star" : "spark",
      });
    }
  }

  function roundHit(team) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dir = team === "red" ? 1 : -1;
    const x = w * 0.5;
    const y = h * 0.56;
    const meta = teamMeta[team];
    scene.shake = 18;
    scene.hitStop = 0.08;
    scene.flash = Math.max(scene.flash, 0.42);
    scene.winnerPulse = { team, life: 1.15, max: 1.15 };
    scene.shockwaves.push({ x, y, r: 34, life: 0.75, max: 0.75, color: meta.accent });
    banner("CRITICAL HIT", `${meta.name} +1 POWER`, 1.1);

    for (let i = 0; i < 42; i += 1) {
      scene.particles.push({
        x: x - dir * 42,
        y: y + (Math.random() - 0.5) * 50,
        vx: dir * (240 + Math.random() * 520),
        vy: -260 + Math.random() * 460,
        life: 0.55 + Math.random() * 0.5,
        max: 1.05,
        color: i % 3 === 0 ? "#ffffff" : meta.accent,
        size: 5 + Math.random() * 10,
        kind: "slash",
      });
    }
  }

  function finalBreak(team) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dir = team === "red" ? 1 : -1;
    const meta = teamMeta[team];
    const cx = w * 0.5;
    const cy = h * 0.55;
    scene.shake = 42;
    scene.flash = 1.25;
    scene.hitStop = 0.12;
    scene.winnerPulse = { team, life: 2.6, max: 2.6 };
    scene.rubble = [];
    scene.beams.push({ team, x1: team === "red" ? w * 0.23 : w * 0.77, y1: h * 0.55, x2: cx, y2: cy, life: 1.15, max: 1.15 });
    scene.shockwaves.push({ x: cx, y: cy, r: 50, life: 1.25, max: 1.25, color: "#ffffff" });
    banner("LIMIT BREAK", `${meta.name} ROMPE LA INERCIA`, 1.8);

    labels.forEach((label, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const bw = Math.min(170, w * 0.17);
      const bh = 58;
      const x = cx + (col - 0.5) * (bw + 10);
      const y = cy + (row - 1) * (bh + 10);
      for (let piece = 0; piece < 6; piece += 1) {
        const angle = Math.atan2(y - cy, x - cx) + dir * 0.18 + (Math.random() - 0.5) * 1.65;
        const speed = 260 + Math.random() * 520;
        scene.rubble.push({
          x: x + (Math.random() - 0.5) * bw,
          y: y + (Math.random() - 0.5) * bh,
          w: bw * (0.18 + Math.random() * 0.25),
          h: bh * (0.25 + Math.random() * 0.35),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 220,
          rot: Math.random() * Math.PI,
          vr: -6 + Math.random() * 12,
          label: piece === 0 ? label : "",
          life: 2.8,
        });
      }
    });

    for (let i = 0; i < 190; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 170 + Math.random() * 820;
      scene.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 80,
        life: 0.7 + Math.random() * 1.25,
        max: 1.95,
        color: i % 4 === 0 ? "#ffffff" : i % 4 === 1 ? meta.accent : i % 4 === 2 ? meta.main : "#7df9ff",
        size: 3 + Math.random() * 10,
        kind: i % 6 === 0 ? "star" : "spark",
      });
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawBackground(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#141b38");
    g.addColorStop(0.48, "#070b18");
    g.addColorStop(1, "#030409");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const pulse = 0.5 + Math.sin(scene.t * 2.6) * 0.5;
    [[w * 0.18, "rgba(255,59,79,"], [w * 0.82, "rgba(58,160,255,"]].forEach(([x, color]) => {
      const rg = ctx.createRadialGradient(x, h * 0.22, 20, x, h * 0.28, w * 0.34);
      rg.addColorStop(0, `${color}${0.22 + pulse * 0.12})`);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    });

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "#75e6ff";
    ctx.lineWidth = 1;
    for (let x = -w; x < w * 2; x += 54) {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.72);
      ctx.lineTo(x + w * 0.35, h);
      ctx.stroke();
    }
    for (let y = h * 0.72; y < h; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 22; i += 1) {
      const x = (i * 137 + scene.t * (20 + i % 4)) % (w + 140) - 70;
      ctx.fillRect(x, 34 + (i % 8) * 28, 34 + (i % 3) * 20, 4);
    }

    ctx.fillStyle = "#0d111c";
    ctx.fillRect(0, h * 0.73, w, h * 0.27);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(0, h * 0.73, w, 5);
  }

  function drawFighter(team, x, ground, scale) {
    const meta = teamMeta[team];
    const power = scene.state?.power?.[team] || 0;
    const dir = team === "red" ? 1 : -1;
    const pulse = scene.winnerPulse?.team === team ? scene.winnerPulse : null;
    const finalAttacker = scene.state?.phase === "final" && scene.state?.winner === team;
    const attacking = Boolean(pulse || finalAttacker);
    const pulseProgress = pulse ? 1 - pulse.life / pulse.max : finalAttacker ? 1 : 0;
    const lunge = attacking ? Math.sin(Math.min(1, pulseProgress) * Math.PI) * (finalAttacker ? 135 : 92) : 0;
    const bob = Math.sin(scene.t * 6 + (team === "red" ? 0 : 1.1)) * 5;
    const px = x + lunge * dir;
    const py = ground + bob;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(dir * scale, scale);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 88, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (power >= 7 || attacking) {
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.sin(scene.t * 8) * 0.06;
      ctx.strokeStyle = power >= 10 ? "#ffffff" : meta.accent;
      ctx.lineWidth = 8;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(0, -108, 96 + i * 18 + Math.sin(scene.t * 6 + i) * 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#050507";

    ctx.fillStyle = "#222b3e";
    roundedRect(-42, -112, 84, 104, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = meta.main;
    roundedRect(-52, -120, 104, 64, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = meta.accent;
    ctx.fillRect(-38, -106, 76, 12);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(-18, -118, 18, 58);

    ctx.fillStyle = "#f1c08c";
    roundedRect(-38, -200, 76, 78, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#10131b";
    roundedRect(-46, -210, 92, 32, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#050507";
    ctx.fillRect(-23, -164, 10, 12);
    ctx.fillRect(15, -164, 10, 12);
    ctx.fillRect(-12, -140, 30, 6);

    const punch = attacking ? 55 + Math.sin(scene.t * 22) * 16 : 14 + Math.sin(scene.t * 8) * 9;
    ctx.fillStyle = meta.main;
    roundedRect(30, -109, 86 + punch, 25, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f1c08c";
    roundedRect(108 + punch, -114, 30, 34, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = meta.main;
    roundedRect(-114, -105, 84, 25, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1d2537";
    roundedRect(-36, -18, 28, 72, 8);
    ctx.fill();
    ctx.stroke();
    roundedRect(10, -18, 28, 72, 8);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawCracks(x, y, w, h, level, seed) {
    ctx.strokeStyle = level > 1 ? "rgba(7,16,28,0.82)" : "rgba(7,16,28,0.58)";
    ctx.lineWidth = level > 1 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.25, y + 8);
    ctx.lineTo(x + w * 0.43, y + h * 0.38);
    ctx.lineTo(x + w * 0.36, y + h * 0.64);
    ctx.lineTo(x + w * 0.58, y + h - 8);
    if (level > 1) {
      ctx.moveTo(x + w * 0.43, y + h * 0.38);
      ctx.lineTo(x + w * 0.66, y + h * 0.28);
      ctx.moveTo(x + w * 0.36, y + h * 0.64);
      ctx.lineTo(x + w * 0.18, y + h * 0.82);
      ctx.moveTo(x + w * 0.58, y + h - 8);
      ctx.lineTo(x + w * 0.78, y + h * 0.72);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#07101c";
    for (let i = 0; i < level * 3; i += 1) {
      ctx.fillRect(x + ((seed * 23 + i * 31) % Math.max(1, w - 14)) + 7, y + 8 + ((seed * 17 + i * 19) % Math.max(1, h - 18)), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawWall(w, h) {
    if (scene.state?.phase === "final") return;
    const hits = scene.state?.wallHits || 0;
    const pressure = Math.max(scene.state?.power?.red || 0, scene.state?.power?.blue || 0);
    const activeBlock = Math.min(labels.length - 1, Math.floor(hits / 2));

    labels.forEach((label, index) => {
      const rect = wallBlockRect(index, w, h);
      const damage = Math.max(0, Math.min(2, hits - index * 2));
      const broken = damage >= 2;
      if (broken) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.strokeStyle = "#7df9ff";
        ctx.lineWidth = 2;
        roundedRect(rect.x + 7, rect.y + 7, rect.w - 14, rect.h - 14, 5);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const tremble = index === activeBlock ? Math.sin(scene.t * 15 + index) * (2 + pressure * 0.18) : Math.sin(scene.t * 7 + index) * pressure * 0.08;
      const x = rect.x + tremble;
      const y = rect.y + (damage === 1 ? Math.sin(scene.t * 18 + index) * 1.5 : 0);
      const gradient = ctx.createLinearGradient(x, y, x, y + rect.h);
      gradient.addColorStop(0, damage ? "#f3f7fb" : "#c9d8e6");
      gradient.addColorStop(1, damage ? "#8fa1b3" : "#a9bac9");
      ctx.fillStyle = gradient;
      roundedRect(x, y, rect.w, rect.h, 5);
      ctx.fill();
      ctx.lineWidth = damage ? 5 : 4;
      ctx.strokeStyle = damage ? "#ffd166" : "#050507";
      ctx.stroke();
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(x + 6, y + rect.h - 12, rect.w - 12, 5);
      if (damage === 1) drawCracks(x, y, rect.w, rect.h, 1, index);
      ctx.fillStyle = "#07101c";
      ctx.font = `800 ${Math.max(13, Math.min(17, w / 70))}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + rect.w / 2, y + rect.h / 2, rect.w - 14);
    });
  }

  function drawBeams(dt) {
    scene.beams = scene.beams.filter((beam) => beam.life > 0);
    scene.beams.forEach((beam) => {
      beam.life -= dt;
      const alpha = Math.max(0, beam.life / beam.max);
      const meta = teamMeta[beam.team];
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 34 * alpha + 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
      ctx.strokeStyle = meta.accent;
      ctx.lineWidth = 18 * alpha + 4;
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawShockwaves(dt) {
    scene.shockwaves = scene.shockwaves.filter((wave) => wave.life > 0);
    scene.shockwaves.forEach((wave) => {
      wave.life -= dt;
      const p = 1 - wave.life / wave.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 8 * (1 - p) + 2;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.r + p * 220, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawRubble(dt) {
    scene.rubble = scene.rubble.filter((piece) => piece.life > 0);
    scene.rubble.forEach((piece) => {
      piece.life -= dt;
      piece.vy += 560 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      piece.rot += piece.vr * dt;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, piece.life));
      ctx.fillStyle = "#c9d8e6";
      roundedRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h, 4);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#050507";
      ctx.stroke();
      if (piece.label) {
        ctx.fillStyle = "#07101c";
        ctx.font = "800 12px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(piece.label, 0, 0, piece.w - 8);
      }
      ctx.restore();
    });
  }

  function drawParticles(dt) {
    scene.particles = scene.particles.filter((p) => p.life > 0);
    scene.particles.forEach((p) => {
      p.life -= dt;
      p.vy += 390 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const alpha = Math.max(0, p.life / p.max);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.kind === "slash") {
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.size * 2.8, -p.size * 0.34, p.size * 5.6, p.size * 0.68);
      } else if (p.kind === "star") {
        ctx.translate(p.x, p.y);
        ctx.rotate(scene.t * 8 + p.x);
        ctx.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const r = i % 2 === 0 ? p.size * 1.5 : p.size * 0.55;
          const a = (Math.PI * 2 * i) / 10;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawArcadeOverlay(w, h) {
    if (!scene.state) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (scene.state.phase === "lobby") {
      ctx.globalAlpha = 0.24 + Math.sin(scene.t * 3) * 0.08;
      ctx.fillStyle = "#ffffff";
      ctx.font = `1000 ${Math.min(150, w / 7)}px Segoe UI, sans-serif`;
      ctx.fillText("VS", w / 2, h * 0.38);
    }

    if (scene.banner) {
      scene.banner.life -= 1 / 60;
      const p = Math.max(0, scene.banner.life / scene.banner.max);
      const scale = 0.82 + (1 - p) * 0.28;
      ctx.translate(w / 2, h * 0.22);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(1, p * 1.8);
      ctx.fillStyle = "#050507";
      ctx.font = `1000 ${Math.min(74, w / 13)}px Segoe UI, sans-serif`;
      ctx.fillText(scene.banner.text, 5, 7);
      ctx.fillStyle = "#ffd166";
      ctx.fillText(scene.banner.text, 0, 0);
      if (scene.banner.subtext) {
        ctx.font = `900 ${Math.min(24, w / 42)}px Segoe UI, sans-serif`;
        ctx.fillStyle = "#f7fbff";
        ctx.fillText(scene.banner.subtext, 0, 52);
      }
      if (scene.banner.life <= 0) scene.banner = null;
    }
    ctx.restore();
  }

  function drawImpactText() {
    const text = document.getElementById("impactText");
    if (!text) return;
    const active = scene.state?.phase === "final";
    text.classList.toggle("show", active);
    text.textContent = active && scene.state?.winner ? `${teamMeta[scene.state.winner].name} EJECUTA` : "EJECUCION";
  }

  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (scene.hitStop > 0) {
      scene.hitStop -= dt;
      dt = 0.004;
    }
    scene.t += dt;
    scene.flash = Math.max(0, scene.flash - dt * 1.8);
    scene.shake = Math.max(0, scene.shake - dt * 21);
    if (scene.winnerPulse) {
      scene.winnerPulse.life -= dt;
      if (scene.winnerPulse.life <= 0) scene.winnerPulse = null;
    }

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const sx = (Math.random() - 0.5) * scene.shake;
    const sy = (Math.random() - 0.5) * scene.shake;
    ctx.save();
    ctx.translate(sx, sy);
    drawBackground(w, h);
    drawBeams(dt);
    drawFighter("red", w * 0.22, h * 0.73, Math.max(0.75, Math.min(1.1, w / 1080)));
    drawFighter("blue", w * 0.78, h * 0.73, Math.max(0.75, Math.min(1.1, w / 1080)));
    drawWall(w, h);
    drawRubble(dt);
    drawShockwaves(dt);
    drawParticles(dt);
    ctx.restore();

    if (scene.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${scene.flash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }

    drawArcadeOverlay(w, h);
    drawImpactText();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", fit);
  window.addEventListener("arcade-state", (event) => onState(event.detail));
  fit();
  if (window.arcade4dxState) onState(window.arcade4dxState);
  requestAnimationFrame(frame);
})();
