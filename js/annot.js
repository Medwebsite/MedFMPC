/* =====================================================================
   Stylo, surligneur et gomme sur les PDF et les images.
   Le document est affiché dans le site (PDF.js) et les traits sont
   enregistrés pour chaque étudiant (privés).
   Les coordonnées sont relatives à la page (0 → 1) : les traits restent
   bien placés quel que soit le zoom ou l'écran.
   ===================================================================== */
(function () {
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#facc15"];
  const WIDTH = { pen: 0.0028, hl: 0.02 };
  const ERASE_R = 0.015;
  const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2];

  const ICON = {
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    hl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7M5 11l9 9"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-4.3-4.3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M21 21l-4.3-4.3"/></svg>',
  };

  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error("Impossible de charger le lecteur PDF. Vérifie ta connexion.")); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  // Dessine un trait sur un canvas (coordonnées 0..1)
  function drawStroke(ctx, s, W, H) {
    const p = s.p; if (!p || p.length < 2) return;
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
    ctx.globalAlpha = s.t === "hl" ? 0.35 : 1;
    ctx.lineWidth = Math.max(1, s.w * W);
    if (p.length === 2) { ctx.beginPath(); ctx.arc(p[0] * W, p[1] * H, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    ctx.beginPath(); ctx.moveTo(p[0] * W, p[1] * H);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * W, p[i + 1] * H);
    ctx.stroke(); ctx.restore();
  }

  // Distance d'un point à un trait (pour la gomme)
  function hits(s, x, y, r, ratio) {
    const p = s.p, r2 = (r + s.w / 2) * (r + s.w / 2);
    for (let i = 0; i < p.length; i += 2) {
      const dx = p[i] - x, dy = (p[i + 1] - y) * ratio;
      if (dx * dx + dy * dy <= r2) return true;
      if (i + 3 < p.length) { // segment
        const ax = p[i], ay = p[i + 1] * ratio, bx = p[i + 2], by = p[i + 3] * ratio, py = y * ratio;
        const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
        if (L > 0) {
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (py - ay) * vy) / L));
          const cx = ax + t * vx - x, cy = ay + t * vy - py;
          if (cx * cx + cy * cy <= r2) return true;
        }
      }
    }
    return false;
  }

  async function mount(root, opts) {
    const T = opts.t || ((x) => x);
    const data = opts.data && opts.data.pages ? opts.data : { v: 1, pages: {} };
    const st = { tool: "hand", color: COLORS[0], zoom: 2 };
    const history = [];
    let saveTimer = null;

    root.innerHTML = `
      <div class="annot-bar" role="toolbar" aria-label="${T("Outils d'annotation")}">
        <div class="ab-group">
          <button type="button" data-tool="hand" title="${T("Défiler")}" aria-label="${T("Défiler")}">${ICON.hand}</button>
          <button type="button" data-tool="pen" title="${T("Stylo")}" aria-label="${T("Stylo")}">${ICON.pen}</button>
          <button type="button" data-tool="hl" title="${T("Surligneur")}" aria-label="${T("Surligneur")}">${ICON.hl}</button>
          <button type="button" data-tool="eraser" title="${T("Gomme")}" aria-label="${T("Gomme")}">${ICON.eraser}</button>
        </div>
        <div class="ab-group ab-colors">${COLORS.map((c) => `<button type="button" class="ab-color" data-color="${c}" style="--c:${c}" title="${T("Couleur")}" aria-label="${T("Couleur")} ${c}"></button>`).join("")}</div>
        <div class="ab-group">
          <button type="button" data-act="undo" title="${T("Annuler le dernier trait")}" aria-label="${T("Annuler le dernier trait")}">${ICON.undo}</button>
          <button type="button" data-act="zout" title="${T("Dézoomer")}" aria-label="${T("Dézoomer")}">${ICON.minus}</button>
          <button type="button" data-act="zin" title="${T("Zoomer")}" aria-label="${T("Zoomer")}">${ICON.plus}</button>
        </div>
        <span class="ab-status small muted" aria-live="polite"></span>
      </div>
      <div class="annot-pages"><div class="annot-loading"><div class="spinner"></div><span class="small muted">${T("Chargement du document…")}</span></div></div>`;

    const bar = root.querySelector(".annot-bar");
    const pagesEl = root.querySelector(".annot-pages");
    const statusEl = root.querySelector(".ab-status");
    const setStatus = (t) => { statusEl.textContent = t ? T(t) : ""; };

    function refreshBar() {
      bar.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === st.tool));
      bar.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("on", b.dataset.color === st.color));
      bar.querySelector("[data-act=undo]").disabled = !history.length;
      root.classList.toggle("drawing", st.tool !== "hand");
      root.dataset.tool = st.tool;
    }
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.tool) st.tool = b.dataset.tool;
      if (b.dataset.color) { st.color = b.dataset.color; if (st.tool === "hand" || st.tool === "eraser") st.tool = "pen"; }
      if (b.dataset.act === "undo") undo();
      if (b.dataset.act === "zin" && st.zoom < ZOOMS.length - 1) { st.zoom++; applyZoom(); }
      if (b.dataset.act === "zout" && st.zoom > 0) { st.zoom--; applyZoom(); }
      refreshBar();
    });
    refreshBar();

    function changed() {
      setStatus("Modifications non enregistrées");
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 1200);
    }
    let saving = Promise.resolve();
    function flush() {
      clearTimeout(saveTimer); saveTimer = null;
      const snapshot = JSON.parse(JSON.stringify(data));
      setStatus("Enregistrement…");
      saving = saving.then(() => opts.onSave(snapshot))
        .then(() => { if (document.body.contains(statusEl)) setStatus("Enregistré ✓"); })
        .catch((e) => { if (document.body.contains(statusEl)) setStatus(""); if (opts.onError) opts.onError(e); });
      return saving;
    }

    // ---- Chargement du document ----
    let pages = []; // { n, el, base, ink, ratio, rendered, render() }
    try {
      const resp = await fetch(opts.src);
      if (!resp.ok) throw new Error(T("Impossible de charger ce fichier") + ` (${resp.status}).`);
      const buf = await resp.arrayBuffer();
      if (opts.kind === "pdf") {
        await loadScript(PDFJS);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const vp = page.getViewport({ scale: 1 });
          pages.push({ n, ratio: vp.height / vp.width, draw: async (canvas, w) => {
            const scale = w / vp.width;
            const v = page.getViewport({ scale });
            canvas.width = Math.round(v.width); canvas.height = Math.round(v.height);
            await page.render({ canvasContext: canvas.getContext("2d"), viewport: v }).promise;
          } });
        }
      } else {
        const url = URL.createObjectURL(new Blob([buf]));
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(T("Impossible d'afficher cette image."))); i.src = url; });
        pages.push({ n: 1, ratio: img.naturalHeight / img.naturalWidth, draw: async (canvas, w) => {
          canvas.width = Math.round(w); canvas.height = Math.round(w * img.naturalHeight / img.naturalWidth);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        } });
      }
    } catch (e) {
      pagesEl.innerHTML = `<div class="annot-loading"><span>${(e && e.message) || T("Erreur de chargement")}</span></div>`;
      if (opts.onFail) opts.onFail(e);
      return { flush: () => Promise.resolve() };
    }

    pagesEl.innerHTML = pages.map((p) => `<div class="ap" data-n="${p.n}" style="aspect-ratio:${1 / p.ratio}"><canvas class="ap-base"></canvas><canvas class="ap-ink"></canvas><span class="ap-num">${p.n}</span></div>`).join("");
    pages.forEach((p) => {
      p.el = pagesEl.querySelector(`.ap[data-n="${p.n}"]`);
      p.base = p.el.querySelector(".ap-base");
      p.ink = p.el.querySelector(".ap-ink");
      p.rendered = 0;
    });

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    async function renderPage(p) {
      const w = p.el.clientWidth * dpr();
      if (!w || Math.abs(p.rendered - w) < 2) return;
      p.rendered = w;
      await p.draw(p.base, w);
      p.ink.width = p.base.width; p.ink.height = p.base.height;
      redrawInk(p);
    }
    function redrawInk(p) {
      const ctx = p.ink.getContext("2d");
      ctx.clearRect(0, 0, p.ink.width, p.ink.height);
      (data.pages[p.n] || []).forEach((s) => drawStroke(ctx, s, p.ink.width, p.ink.height));
    }
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const p = pages.find((x) => x.el === en.target);
        if (en.isIntersecting) { visible.add(p); renderPage(p); } else visible.delete(p);
      });
    }, { root: pagesEl, rootMargin: "600px 0px" });
    pages.forEach((p) => io.observe(p.el));

    function applyZoom() {
      pagesEl.style.setProperty("--zoom", ZOOMS[st.zoom]);
      requestAnimationFrame(() => visible.forEach(renderPage));
    }
    applyZoom();
    let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => visible.forEach(renderPage), 250); });

    // ---- Dessin ----
    let cur = null;
    function pos(p, e) {
      const r = p.ink.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    }
    function eraseAt(p, x, y) {
      const list = data.pages[p.n] || [];
      const keep = [], removed = [];
      list.forEach((s) => (hits(s, x, y, ERASE_R, p.ratio) ? removed : keep).push(s));
      if (removed.length) {
        data.pages[p.n] = keep;
        history.push({ n: p.n, removed });
        redrawInk(p); refreshBar(); changed();
      }
    }
    pages.forEach((p) => {
      p.ink.addEventListener("pointerdown", (e) => {
        if (st.tool === "hand" || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        try { p.ink.setPointerCapture(e.pointerId); } catch (err) {}
        const [x, y] = pos(p, e);
        if (st.tool === "eraser") { cur = { p, erase: true }; eraseAt(p, x, y); return; }
        const s = { t: st.tool, c: st.tool === "hl" && st.color === COLORS[0] ? COLORS[4] : st.color, w: WIDTH[st.tool], p: [+x.toFixed(4), +y.toFixed(4)] };
        cur = { p, s };
        drawStroke(p.ink.getContext("2d"), s, p.ink.width, p.ink.height);
      });
      p.ink.addEventListener("pointermove", (e) => {
        if (!cur || cur.p !== p) return;
        const [x, y] = pos(p, e);
        if (cur.erase) { eraseAt(p, x, y); return; }
        const pts = cur.s.p, lx = pts[pts.length - 2], ly = pts[pts.length - 1];
        if (Math.hypot(x - lx, (y - ly) * p.ratio) < 0.002) return;
        pts.push(+x.toFixed(4), +y.toFixed(4));
        const ctx = p.ink.getContext("2d");
        if (cur.s.t === "hl") { redrawInk(p); drawStroke(ctx, cur.s, p.ink.width, p.ink.height); }
        else drawStroke(ctx, { ...cur.s, p: pts.slice(-4) }, p.ink.width, p.ink.height);
      });
      const end = () => {
        if (!cur || cur.p !== p) return;
        if (cur.s) {
          (data.pages[p.n] = data.pages[p.n] || []).push(cur.s);
          history.push({ n: p.n, added: cur.s });
          redrawInk(p); refreshBar(); changed();
        }
        cur = null;
      };
      p.ink.addEventListener("pointerup", end);
      p.ink.addEventListener("pointercancel", end);
    });

    function undo() {
      const h = history.pop(); if (!h) return;
      const p = pages.find((x) => x.n === h.n);
      if (h.added) data.pages[h.n] = (data.pages[h.n] || []).filter((s) => s !== h.added);
      if (h.removed) data.pages[h.n] = (data.pages[h.n] || []).concat(h.removed);
      if (p) redrawInk(p);
      changed();
    }

    return { flush: () => (saveTimer ? flush() : saving) };
  }

  window.Annot = { mount };
})();
