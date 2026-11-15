/* Shared behaviour: theme, reveals, OS detection, help page tabs and contents. */
(function () {
  "use strict";
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // ------------------------------------------------------------ theme
  function isDark() {
    const t = root.getAttribute("data-theme");
    return t ? t === "dark" : darkQuery.matches;
  }
  function syncToggle() {
    document.querySelectorAll(".theme-toggle").forEach((b) => {
      const dark = isDark();
      b.setAttribute("aria-label", dark ? "Switch to light colours" : "Switch to dark colours");
      b.setAttribute("title", dark ? "Light" : "Dark");
      b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z"/></svg>';
    });
  }
  function themeChanged() {
    syncToggle();
    document.dispatchEvent(new CustomEvent("themechange"));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".theme-toggle");
    if (!b) return;
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (_) {}
    themeChanged();
  });
  darkQuery.addEventListener("change", () => { if (!root.getAttribute("data-theme")) themeChanged(); });
  syncToggle();

  // ---------------------------------------------------------- reveals
  // A clip-path-hidden plate reports no intersection, so plates are revealed
  // when their parent comes into view.
  const revealables = Array.from(document.querySelectorAll(".reveal, .reveal-plate"));
  if ("IntersectionObserver" in window && !reduced.matches && root.classList.contains("motion")) {
    const targets = new Map();
    for (const el of revealables) {
      const watch = el.classList.contains("reveal-plate") ? el.parentElement : el;
      if (!targets.has(watch)) targets.set(watch, []);
      targets.get(watch).push(el);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            (targets.get(en.target) || []).forEach((el) => el.classList.add("in"));
            io.unobserve(en.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 }
    );
    targets.forEach((_, watch) => io.observe(watch));
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }

  // ------------------------------------------------ your-system download
  const ua = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || "";
  const os = /mac/i.test(ua) ? "macos" : /linux|x11|cros/i.test(ua) && !/android/i.test(ua) ? "linux" : /win/i.test(ua) ? "windows" : null;
  const names = { windows: "Windows", linux: "Linux", macos: "macOS" };
  if (os) {
    const col = document.querySelector(`.dl-os[data-os="${os}"]`);
    if (col) col.classList.add("is-yours");
    const primary = document.querySelector("[data-download-primary]");
    const first = col && col.querySelector("a.dl");
    if (primary && first) {
      primary.href = first.href;
      const label = primary.querySelector("[data-os-name]");
      if (label) label.textContent = names[os];
    }
  }

  // ------------------------------------------------------ help: OS tabs
  document.querySelectorAll(".os-tabs").forEach((box) => {
    const tabs = Array.from(box.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    function select(i, focus) {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          select((i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true);
        }
      });
    });
    const start = os ? tabs.findIndex((t) => t.dataset.os === os) : 0;
    select(start >= 0 ? start : 0);
  });

  // ------------------------------------------------- help: contents spy
  const toc = document.querySelector(".toc");
  if (toc) {
    const links = Array.from(toc.querySelectorAll("a[href^='#']"));
    const sections = links.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      let current = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top < 140) current = s;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
      links.forEach((a) => a.classList.toggle("on", current && a.getAttribute("href") === "#" + current.id));
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
})();
