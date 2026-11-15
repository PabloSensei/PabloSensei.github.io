/* Changelog: stacked bars per release, search and filters.
   Reads the release list the generator pre-rendered into the page. */
(function () {
  "use strict";
  const list = document.getElementById("releases");
  if (!list) return;
  const releases = Array.from(list.querySelectorAll(".release"));
  const items = Array.from(list.querySelectorAll(".rel-group li"));
  const input = document.getElementById("q");
  const status = document.getElementById("status");
  const none = document.getElementById("none");
  const kindBtns = Array.from(document.querySelectorAll(".kind-btn"));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const original = new Map(items.map((li) => [li, li.innerHTML]));
  const KINDS = ["new", "improved", "fixed", "hood"];
  const KIND_NAME = { new: "new", improved: "improved", fixed: "fixed", hood: "under the hood" };
  const kindOf = (li) => li.closest(".rel-group").dataset.kind;

  for (const b of kindBtns) {
    b.querySelector(".n").textContent = list.querySelectorAll(`.rel-group[data-kind="${b.dataset.kind}"] li`).length;
  }

  // --------------------------------------------------------------- bars
  const fig = document.getElementById("bars");
  const plot = fig.querySelector(".bars-plot");
  const tip = fig.querySelector(".bars-tip");
  const data = releases
    .map((r) => {
      const counts = {};
      for (const k of KINDS) counts[k] = r.querySelectorAll(`.rel-group[data-kind="${k}"] li`).length;
      const time = r.querySelector("time");
      return { el: r, id: r.id, version: r.dataset.version, counts, total: KINDS.reduce((s, k) => s + counts[k], 0), date: time ? time.textContent : "" };
    })
    .reverse(); // oldest first

  function draw() {
    const W = Math.max(300, plot.clientWidth);
    const H = W < 600 ? 200 : 240;
    const padL = 30, padR = 6, padT = 10, padB = 30;
    const max = Math.max(...data.map((d) => d.total), 5);
    const top = Math.ceil(max / 10) * 10;
    const slot = (W - padL - padR) / data.length;
    const bw = Math.max(6, Math.min(30, slot * 0.62));
    const y = (v) => padT + (1 - v / top) * (H - padT - padB);
    const base = H - padB;
    const every = Math.ceil(42 / slot);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Changes per release, from ${data[0].version} to ${data[data.length - 1].version}">`;
    for (let v = 10; v <= top; v += 10) svg += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    data.forEach((d, i) => {
      const cx = padL + slot * (i + 0.5);
      const last = data.length - 1;
      const show = i === last || (i % every === 0 && last - i >= every);
      svg += `<g class="col" tabindex="0" role="link" aria-label="Arro ${d.version}, ${d.date}: ${d.total} changes" data-i="${i}" style="--i:${i}">`;
      svg += `<rect class="hit" x="${cx - slot / 2 + 1}" y="${padT - 6}" width="${slot - 2}" height="${base - padT + 28}" rx="4"/>`;
      svg += `<g class="stack">`;
      let acc = 0;
      for (const k of KINDS) {
        const n = d.counts[k];
        if (!n) continue;
        svg += `<rect class="seg ${k}" x="${cx - bw / 2}" y="${y(acc + n)}" width="${bw}" height="${y(acc) - y(acc + n)}"/>`;
        acc += n;
      }
      svg += `</g>`;
      if (show) svg += `<text x="${cx}" y="${base + 19}">${d.version.replace(/^0\./, ".")}</text>`;
      svg += `</g>`;
    });
    svg += `<line class="base" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}"/></svg>`;
    plot.innerHTML = svg;

    plot.querySelectorAll(".col").forEach((g) => {
      const i = Number(g.dataset.i);
      const d = data[i];
      const cx = padL + slot * (i + 0.5);
      const show = () => {
        const parts = KINDS.filter((k) => d.counts[k]).map((k) => `${d.counts[k]} ${KIND_NAME[k]}`);
        tip.innerHTML = `<b>${d.version}</b> · ${d.date}<br>${parts.join(", ") || "notes"}`;
        const half = 100;
        tip.style.left = `${Math.min(Math.max(plot.offsetLeft + cx, half), fig.clientWidth - half)}px`;
        tip.style.top = `${plot.offsetTop + y(d.total)}px`;
        tip.classList.add("on");
        g.classList.add("on");
      };
      const hide = () => { tip.classList.remove("on"); g.classList.remove("on"); };
      const go = () => {
        hide();
        history.replaceState(null, "", `${location.search}#${d.id}`);
        d.el.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth", block: "start" });
        const h = d.el.querySelector("h2");
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      };
      g.addEventListener("pointerenter", show);
      g.addEventListener("pointerleave", hide);
      g.addEventListener("focus", show);
      g.addEventListener("blur", hide);
      g.addEventListener("click", go);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    applyDim();
  }

  // ----------------------------------------------------- filter + search
  const terms = () => input.value.toLowerCase().split(/\s+/).filter(Boolean);
  const activeKinds = () => new Set(kindBtns.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.kind));
  function highlight(el, ts) {
    if (!ts.length) return;
    const re = new RegExp(`(${ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!re.test(n.nodeValue)) continue;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      n.nodeValue.replace(re, (m, _g, off) => {
        frag.append(n.nodeValue.slice(last, off));
        const mark = document.createElement("mark");
        mark.textContent = m;
        frag.append(mark);
        last = off + m.length;
        return m;
      });
      frag.append(n.nodeValue.slice(last));
      n.replaceWith(frag);
    }
  }

  let visible = new Set(releases.map((r) => r.id));
  const countable = items.filter((li) => kindOf(li) !== "limits").length;
  function apply() {
    const ts = terms();
    const kinds = activeKinds();
    const filtering = ts.length > 0 || kinds.size < KINDS.length;
    let shown = 0;
    visible = new Set();
    for (const li of items) {
      const kind = kindOf(li);
      const kindOk = kind === "limits" ? !filtering : kinds.has(kind);
      const ok = kindOk && ts.every((t) => (li.dataset.text || "").includes(t));
      li.hidden = !ok;
      li.innerHTML = original.get(li);
      if (ok) {
        highlight(li, ts);
        if (kind !== "limits") shown++;
      }
    }
    for (const g of list.querySelectorAll(".rel-group")) g.hidden = !g.querySelector("li:not([hidden])");
    for (const r of releases) {
      r.hidden = filtering && !r.querySelector(".rel-group:not([hidden])");
      if (!r.hidden) visible.add(r.id);
    }
    none.hidden = !(filtering && shown === 0);
    status.textContent = filtering
      ? `${shown} ${shown === 1 ? "change" : "changes"} in ${visible.size} ${visible.size === 1 ? "release" : "releases"}`
      : `${countable} changes in ${releases.length} releases`;
    applyDim();
    const params = new URLSearchParams();
    if (input.value.trim()) params.set("q", input.value.trim());
    if (kinds.size < KINDS.length) params.set("kinds", Array.from(kinds).join(","));
    const qs = params.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? "?" + qs : ""}${location.hash}`);
  }
  function applyDim() {
    plot.querySelectorAll(".col").forEach((g) => g.classList.toggle("dim", !visible.has(data[Number(g.dataset.i)].id)));
  }

  let t;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 90); });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape" && input.value) { input.value = ""; apply(); } });
  for (const b of kindBtns) b.addEventListener("click", () => { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); apply(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });

  const params = new URLSearchParams(location.search);
  if (params.get("q")) input.value = params.get("q");
  if (params.get("kinds")) {
    const on = new Set(params.get("kinds").split(","));
    for (const b of kindBtns) b.setAttribute("aria-pressed", String(on.has(b.dataset.kind)));
  }

  if (data.length > 1) {
    fig.hidden = false;
    draw();
    let rt, lastW = plot.clientWidth;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (Math.abs(plot.clientWidth - lastW) > 2) { lastW = plot.clientWidth; draw(); } }, 150);
    });
  }
  apply();
})();
