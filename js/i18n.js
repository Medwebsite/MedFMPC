/* =====================================================================
   Langues : français (texte d'origine), arabe (RTL) et anglais.
   Le texte de l'interface est traduit automatiquement à l'affichage
   grâce au dictionnaire de js/i18n-dict.js. Les contenus (noms des
   cours, actualités, noms des personnes) ne sont pas traduits.
   ===================================================================== */
(function () {
  const KEY = "medfmpc-lang";
  const LANGS = ["fr", "ar", "en"];
  const LOCALES = { fr: "fr-FR", ar: "ar-MA", en: "en-GB" };
  const DICT = window.I18N_DICT || { ar: {}, en: {} };
  const PATTERNS = window.I18N_PATTERNS || { ar: [], en: [] };
  // Zones de contenu à ne jamais traduire
  const SKIP = "script,style,textarea,code,.nm > b,.lx-name,.news-body,.news h3,#user-name,.explorer-title,.module-group h4,[data-i18n-skip]";
  const ATTRS = ["placeholder", "title", "aria-label"];

  let lang = "fr";
  try { const l = localStorage.getItem(KEY); if (LANGS.includes(l)) lang = l; } catch (e) {}

  const original = new WeakMap(); // nœud texte -> texte français d'origine
  let busy = false;

  // Traduit un texte « normalisé » ; renvoie undefined si inconnu
  function tr(t, depth) {
    if (!t || !/[A-Za-zÀ-ÿ]/.test(t)) return undefined;
    const d = DICT[lang] || {};
    if (d[t] !== undefined) return d[t];
    if ((depth || 0) > 4) return undefined;
    const sub = (x) => { const r = tr(x.trim(), (depth || 0) + 1); return r === undefined ? x.trim() : r; };
    for (const [re, rep] of PATTERNS[lang] || []) {
      const m = t.match(re);
      if (m) return typeof rep === "function" ? rep(m, sub) : t.replace(re, rep);
    }
    // Textes composés : « Médecine · 2ème année », « Accueil — MedFMPC »…
    for (const sep of [" · ", " — "]) {
      if (t.includes(sep)) {
        const parts = t.split(sep).map((x) => x.trim());
        let changed = false;
        const out = parts.map((x) => { if (!x) return x; const r = tr(x, (depth || 0) + 1); if (r !== undefined) { changed = true; return r; } return x; });
        if (changed) return out.join(sep);
      }
    }
    return undefined;
  }

  function translate(str) {
    if (lang === "fr" || !str) return str;
    const t = str.replace(/\s+/g, " ").trim();
    if (!t) return str;
    const out = tr(t, 0);
    if (out === undefined) return str;
    const lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
    return lead + out + trail;
  }

  function skipped(el) { return el && el.closest && el.closest(SKIP); }

  function doText(n) {
    if (!original.has(n)) original.set(n, n.nodeValue);
    const src = original.get(n);
    const v = translate(src);
    if (n.nodeValue !== v) n.nodeValue = v;
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const key = "data-i18n-" + a;
      if (!el.hasAttribute(key)) el.setAttribute(key, el.getAttribute(a));
      const v = translate(el.getAttribute(key));
      if (el.getAttribute(a) !== v) el.setAttribute(a, v);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skipped(root.parentElement)) doText(root); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    doAttrs(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && skipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) doText(n); }
      else doAttrs(n);
    }
  }

  function applyDir() {
    const h = document.documentElement;
    h.lang = lang; h.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  }

  const obs = new MutationObserver((muts) => {
    if (busy) return;
    busy = true;
    try {
      for (const m of muts) {
        if (m.type === "characterData") {
          // le site a modifié un texte : on retient la nouvelle version française
          original.set(m.target, m.target.nodeValue);
          if (!skipped(m.target.parentElement)) doText(m.target);
        } else if (m.type === "attributes") {
          if (ATTRS.includes(m.attributeName)) {
            m.target.removeAttribute("data-i18n-" + m.attributeName);
            if (!skipped(m.target)) doAttrs(m.target);
          }
        } else m.addedNodes.forEach(walk);
      }
    } finally { obs.takeRecords(); busy = false; }
  });

  function start() {
    applyDir();
    busy = true; walk(document.body); busy = false;
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lang]");
      if (b) { e.preventDefault(); setLang(b.dataset.lang); }
    });
  }

  function setLang(l) {
    if (!LANGS.includes(l) || l === lang) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    applyDir();
    busy = true; walk(document.body); obs.takeRecords(); busy = false;
    window.dispatchEvent(new Event("langchange")); // le site ré-affiche la page (dates, etc.)
  }

  window.I18N = { lang: () => lang, locale: () => LOCALES[lang], set: setLang, t: translate };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
