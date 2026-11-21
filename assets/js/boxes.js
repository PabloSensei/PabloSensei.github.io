/* Software boxes: canvas box art per product, 3D boxes that turn with the
   pointer, a drag or the keyboard, and decorative barcodes. No dependencies. */
(function () {
  "use strict";
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => reduced.matches || !root.classList.contains("motion");

  // ---------------------------------------------------------- box art

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Arro's dart, from its logo, pointing right, unit size
  function dart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - 0.5 * s, y - 0.56 * s);
    ctx.lineTo(x + 0.5 * s, y);
    ctx.lineTo(x - 0.5 * s, y + 0.56 * s);
    ctx.lineTo(x - 0.15 * s, y);
    ctx.closePath();
    ctx.fill();
  }

  const ART = {
    arro(ctx, w, h, t) {
      ctx.fillStyle = "#1f1f23";
      ctx.fillRect(0, 0, w, h);
      // a field of small darts streaming right: speed
      const r = rng(7);
      const rowH = Math.max(18, w / 11);
      for (let row = 0, y = rowH * 0.5; y < h + rowH; row++, y += rowH) {
        const speed = 18 + r() * 34;
        const gap = rowH * (1.5 + r() * 1.4);
        const off = (t * speed + r() * gap) % gap;
        for (let x = -gap + off; x < w + gap; x += gap) {
          const s = rowH * (0.28 + 0.34 * r());
          ctx.globalAlpha = 0.18 + 0.4 * r();
          ctx.fillStyle = r() < 0.12 ? "#ffffff" : "#ea580c";
          dart(ctx, x, y, s);
        }
      }
      ctx.globalAlpha = 1;
      // the big dart and the caret of the logo
      // on a box the dart fills the lower front; on a wide band it sits at the right
      // on a narrow band or behind centred text it hides in the bottom right corner
      const corner = !!ctx.canvas.closest(".page-head") && (w < 760 || ctx.canvas.dataset.place === "corner");
      const big = corner ? Math.min(w * 0.42, h * 0.5) : Math.min(w * 0.62, h * 0.62);
      const by = corner ? h - big * 0.3 : h * 0.66;
      const bx = (corner ? w - big * 0.3 : w > h * 1.4 ? w - big * 0.9 : w * 0.62) + Math.sin(t * 1.3) * big * 0.02;
      ctx.fillStyle = "#ea580c";
      dart(ctx, bx, by, big);
      ctx.fillStyle = "#ffffff";
      const cw = big * 0.09;
      const blink = Math.sin(t * 4) > -0.6 ? 1 : 0.15;
      ctx.globalAlpha = blink;
      ctx.beginPath();
      ctx.roundRect(bx + big * 0.45 - cw / 2, by - big * 0.36, cw, big * 0.72, cw / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    dictate(ctx, w, h, t) {
      ctx.fillStyle = "#d42f28";
      ctx.fillRect(0, 0, w, h);
      const cx = w * 0.7, cy = h * 0.64;
      const step = Math.max(8, w / 22);
      const phase = (t * 22) % step;
      ctx.strokeStyle = "#1a0b0a";
      for (let rr = phase + step; rr < Math.hypot(w, h); rr += step) {
        ctx.globalAlpha = Math.max(0, 0.75 - rr / (w * 1.5));
        ctx.lineWidth = Math.max(1.5, w / 120);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a0b0a";
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.09, 0, Math.PI * 2);
      ctx.fill();
      // level bars, as in the dictate bubble
      const bw = w * 0.045, base = h * 0.64, x0 = w * 0.1;
      ctx.fillStyle = "#ffffff";
      const hs = [0.3, 0.7, 1, 0.6, 0.25];
      hs.forEach((k, i) => {
        const bh = w * 0.3 * (k * (0.6 + 0.4 * Math.abs(Math.sin(t * 3 + i * 1.3))));
        ctx.beginPath();
        ctx.roundRect(x0 + i * bw * 1.9, base - bh / 2, bw, bh, bw / 2);
        ctx.fill();
      });
    },

    tunetop(ctx, w, h, t) {
      ctx.fillStyle = "#e8458b";
      ctx.fillRect(0, 0, w, h);
      // a record sliding out of its sleeve
      const cx = w * 0.82, cy = h * 0.66, R = w * 0.58;
      ctx.fillStyle = "#3b1d6e";
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e8458b";
      ctx.lineWidth = 1;
      for (let rr = R * 0.36; rr < R * 0.97; rr += Math.max(3, w / 70)) {
        ctx.globalAlpha = 0.16 + 0.1 * Math.sin(rr * 0.7);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      // a highlight that turns with the record
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = Math.max(4, w / 28);
      ctx.strokeStyle = "#ffffff";
      const a = -t * 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.7, a, a + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3b1d6e";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.04, 0, Math.PI * 2);
      ctx.fill();
      // equaliser at the bottom left
      const n = 7, bw = w * 0.04;
      ctx.fillStyle = "#3b1d6e";
      for (let i = 0; i < n; i++) {
        const bh = h * (0.06 + 0.16 * Math.abs(Math.sin(t * 2.4 + i * 0.9)));
        ctx.fillRect(w * 0.08 + i * bw * 1.6, h * 0.86 - bh, bw, bh);
      }
    },

    "ai-translator"(ctx, w, h, t) {
      ctx.fillStyle = "#3c4be0";
      ctx.fillRect(0, 0, w, h);
      const glyphs = ["A", "あ", "Ж", "中", "ع", "Ł", "한", "Ω", "ß", "ह", "é", "ק", "Я", "語"];
      const size = Math.max(16, w / 8);
      ctx.font = `800 ${size}px Archivo, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const r = rng(11);
      const cols = Math.ceil(w / (size * 1.2)) + 1;
      const rows = Math.ceil(h / (size * 1.25)) + 1;
      const band = (t * 0.9) % (rows + 3) - 1.5;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = Math.floor(r() * glyphs.length + t * (0.4 + r()) ) % glyphs.length;
          const d = Math.abs(j - band - i * 0.35);
          // keep the top of the front quiet so the name reads
          const quiet = j * size * 1.25 < h * 0.42;
          ctx.globalAlpha = quiet ? 0.12 : d < 0.9 ? 1 : 0.3;
          ctx.fillStyle = !quiet && d < 0.9 ? "#ffffff" : "#c9cdfb";
          ctx.fillText(glyphs[k], i * size * 1.2 + size * 0.5, j * size * 1.25 + size * 0.6);
        }
      }
      ctx.globalAlpha = 1;
    },

    bowyer(ctx, w, h, t) {
      ctx.fillStyle = "#ede6d5";
      ctx.fillRect(0, 0, w, h);
      // a target low on the front; the name keeps the top
      const cx = w * 0.64, cy = h * 0.7, R = w * 0.4;
      [[1, "#141518"], [0.8, "#ede6d5"], [0.62, "#141518"], [0.44, "#ede6d5"], [0.26, "#d55611"]].forEach(([k, c]) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(cx, cy, R * k, 0, Math.PI * 2);
        ctx.fill();
      });
      const lw = Math.max(1.5, w / 95);
      // an arrow from its tail to the point where it sits in the target
      const arrow = (x1, y1, x2, y2, feather) => {
        const a = Math.atan2(y2 - y1, x2 - x1);
        ctx.strokeStyle = "#141518";
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = feather;
        const f = w * 0.07;
        for (let i = 0; i < 2; i++) {
          const bx = x1 + Math.cos(a) * f * (0.15 + i * 0.55), by = y1 + Math.sin(a) * f * (0.15 + i * 0.55);
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(a) * f * 0.5, by + Math.sin(a) * f * 0.5);
            ctx.lineTo(bx - Math.cos(a + side * 0.9) * f * 0.42, by - Math.sin(a + side * 0.9) * f * 0.42);
            ctx.closePath();
            ctx.fill();
          }
        }
      };
      // every agent's arrow has landed: one per harness
      arrow(w * 0.06, h * 0.48, cx - R * 0.08, cy - R * 0.05, "#d55611");
      arrow(w * 0.02, h * 0.62, cx - R * 0.3, cy + R * 0.12, "#141518");
      arrow(w * 0.1, h * 0.9, cx - R * 0.12, cy + R * 0.28, "#d55611");
      // and one more on its way, until it lands too
      const p = (t * 0.45) % 1;
      if (p < 0.7) {
        const k = p / 0.7;
        const tipX = -w * 0.1 + (cx + R * 0.1 + w * 0.1) * k;
        const tipY = h * 0.55 + (cy - R * 0.2 - h * 0.55) * k;
        const len = w * 0.4;
        const a = Math.atan2(cy - R * 0.2 - h * 0.55, cx + R * 0.1 + w * 0.1);
        arrow(tipX - Math.cos(a) * len, tipY - Math.sin(a) * len, tipX, tipY, "#ffffff");
        ctx.fillStyle = "#141518";
        ctx.beginPath();
        ctx.moveTo(tipX + Math.cos(a) * lw * 3, tipY + Math.sin(a) * lw * 3);
        ctx.lineTo(tipX - Math.cos(a - 0.5) * lw * 3, tipY - Math.sin(a - 0.5) * lw * 3);
        ctx.lineTo(tipX - Math.cos(a + 0.5) * lw * 3, tipY - Math.sin(a + 0.5) * lw * 3);
        ctx.closePath();
        ctx.fill();
      } else {
        arrow(w * 0.12, h * 0.55 + (cy - h * 0.55) * 0.2, cx + R * 0.1, cy - R * 0.2, "#ffffff");
      }
    },
  };

  function paint(canvas, t) {
    const fn = ART[canvas.dataset.art];
    if (!fn) return;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.offsetWidth || rect.width, h = canvas.offsetHeight || rect.height;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fn(ctx, w, h, t);
  }

  const arts = Array.from(document.querySelectorAll("canvas[data-art]"));
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();
  ready.then(() => arts.forEach((c) => paint(c, Number(c.dataset.t) || 2.2)));
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => arts.forEach((c) => paint(c, Number(c.dataset.t) || 2.2)), 150);
  });

  // ------------------------------------------------------------ barcodes
  // Decorative bars derived from the text: a box needs one.
  document.querySelectorAll("svg[data-barcode]").forEach((svg) => {
    const text = svg.dataset.barcode;
    let x = 0;
    let bars = "";
    const r = rng([...text].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const add = (wd, on) => { if (on) bars += `<rect x="${x}" y="0" width="${wd}" height="40"/>`; x += wd; };
    add(1, true); add(1, false); add(1, true); add(1, false);
    for (let i = 0; i < 28; i++) { add(1 + Math.floor(r() * 3), i % 2 === 0); }
    add(1, false); add(1, true); add(1, false); add(1, true);
    svg.setAttribute("viewBox", `0 0 ${x} 40`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = `${x * 2}px`;
    svg.innerHTML = `<g fill="currentColor">${bars}</g>`;
  });

  // -------------------------------------------------------------- boxes
  const all = [];
  const engage = (me) => all.forEach((b) => { if (b !== me) b.reset(); });
  document.querySelectorAll(".box").forEach((box) => {
    const turn = box.querySelector(".box-turn");
    const stage = box.querySelector(".box-stage");
    const art = box.querySelector("canvas[data-art]");
    const btn = box.querySelector(".turn-btn");
    const cs = getComputedStyle(box);
    const baseY = parseFloat(cs.getPropertyValue("--ry")) || -26;
    const baseX = parseFloat(cs.getPropertyValue("--rx")) || -8;
    let ry = baseY, rx = baseX, held = false, drag = null, raf = 0, t0 = 0, playing = false, stopAt = 0;

    const set = (y, x) => {
      ry = y;
      rx = Math.max(-40, Math.min(28, x));
      turn.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      const facingBack = Math.cos(((ry % 360) * Math.PI) / 180) < 0;
      if (btn) btn.setAttribute("aria-pressed", String(facingBack));
    };
    const play = () => {
      if (still() || !art) return;
      stopAt = performance.now() + 900;
      if (playing) return;
      playing = true;
      t0 = t0 || performance.now() - 2200;
      const loop = (now) => {
        paint(art, (now - t0) / 1000);
        if (now < stopAt) raf = requestAnimationFrame(loop);
        else playing = false;
      };
      raf = requestAnimationFrame(loop);
    };

    const self = {
      reset() {
        if (!held && ry === baseY && rx === baseX) return;
        held = false;
        drag = null;
        turn.classList.remove("dragging");
        set(baseY, baseX);
      },
    };
    all.push(self);
    stage.addEventListener("pointerenter", () => engage(self));
    turn.addEventListener("focus", () => engage(self));

    stage.addEventListener("pointermove", (e) => {
      play();
      if (drag) {
        set(drag.y + (e.clientX - drag.x) * 0.6, drag.rx - (e.clientY - drag.cy) * 0.25);
        if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
        return;
      }
      if (held || e.pointerType !== "mouse" || still()) return;
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      set(baseY + px * 46, baseX - py * 16);
    });
    stage.addEventListener("pointerleave", () => { if (!held && !drag) set(baseY, baseX); });
    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // no text selection or image drag while the box is being turned
      e.preventDefault();
      drag = { x: e.clientX, cy: e.clientY, y: ry, rx, moved: false };
      turn.classList.add("dragging");
      stage.setPointerCapture(e.pointerId);
    });
    const end = () => {
      if (!drag) return;
      if (drag.moved) held = true;
      drag = null;
      turn.classList.remove("dragging");
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("dblclick", (e) => { e.preventDefault(); window.getSelection()?.removeAllRanges(); held = false; set(baseY, baseX); });
    stage.addEventListener("selectstart", (e) => e.preventDefault());
    stage.addEventListener("dragstart", (e) => e.preventDefault());

    turn.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "ArrowRight") { held = true; set(ry + (k === "ArrowRight" ? 30 : -30), rx); }
      else if (k === "ArrowUp" || k === "ArrowDown") { held = true; set(ry, rx + (k === "ArrowUp" ? -12 : 12)); }
      else if (k === "Enter" || k === " ") { held = true; set(ry + 180, rx); }
      else if (k === "Escape" || k === "Home") { held = false; set(baseY, baseX); }
      else return;
      e.preventDefault();
      engage(self);
      play();
    });
    if (btn) {
      btn.addEventListener("click", () => {
        engage(self);
        const facingBack = Math.cos((ry * Math.PI) / 180) < 0;
        if (facingBack) { held = false; set(baseY, baseX); }
        else { held = true; set(baseY + 180, baseX); }
        play();
      });
    }
  });

  // drop the shelf in once the faces have their art
  const shelf = document.querySelector(".shelf");
  if (shelf) ready.then(() => setTimeout(() => shelf.classList.add("ready"), 30));
})();
