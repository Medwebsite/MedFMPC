/* =====================================================================
   MedFMPC — application (routage, pages, formulaires)
   ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG;
  const Store = window.Store;
  const Drive = window.Drive;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const main = $("#main");
  const CATEGORIES = ["Info", "Examen", "Cours", "Événement", "Urgent"];
  const MAX_MB = 50;

  /* ---------------------------- utilitaires --------------------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const safeUrl = (u) => (/^(https?:|data:image\/|blob:)/i.test(String(u || "")) ? u : "#");
  const LOC = () => (window.I18N ? I18N.locale() : "fr-FR");
  const fmtDate = (d) => new Date(d).toLocaleDateString(LOC(), { day: "numeric", month: "long", year: "numeric" });
  function timeAgo(d) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    let rtf; try { rtf = new Intl.RelativeTimeFormat(LOC(), { numeric: "auto" }); } catch (e) { return fmtDate(d); }
    if (s < 60) return rtf.format(0, "second");
    if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
    if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
    if (s < 86400 * 7) return rtf.format(-Math.floor(s / 86400), "day");
    return fmtDate(d);
  }
  const T = (x) => (window.I18N ? I18N.t(x) : x);
  const ordinal = (n) => {
    const l = window.I18N ? I18N.lang() : "fr";
    if (l === "ar") return "";
    if (l === "en") return ({ 1: "st", 2: "nd", 3: "rd" })[n] || "th";
    return n === 1 ? "ère" : "ème";
  };
  const humanSize = (b) => {
    b = Number(b); if (!b) return "";
    const u = ["o", "Ko", "Mo", "Go"]; let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return `${b.toFixed(b < 10 && i ? 1 : 0)} ${u[i]}`;
  };
  const filiere = (id) => CFG.filieres.find((f) => f.id === id);
  const anneeInfo = (fid, an) => { const f = filiere(fid); return f && f.annees.find((a) => String(a.annee) === String(an)); };
  const anneeLabel = (fid, an) => { const a = anneeInfo(fid, an); return a ? a.label : `${an}e année`; };
  const semInfo = (fid, an, code) => { const a = anneeInfo(fid, an); return a && a.semestres.find((x) => x.code === code); };
  const driveIdFor = (fid, an, code) => { const x = semInfo(fid, an, code); return (x && x.drive) || ""; };
  const defaultSem = (a) => (a.semestres.find((x) => x.drive) || a.semestres[0]).code;
  const isEditor = () => { const u = Store.user(); return !!u && (u.role === "admin" || u.role === "editor"); };
  const isAdmin = () => { const u = Store.user(); return !!u && u.role === "admin"; };
  const roleLabel = (r) => ({ admin: "Admin principal", editor: "Éditeur", user: "Étudiant" }[r] || r);

  function toast(msg, err = false) {
    const t = $("#toast");
    t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = "toast"), 3200);
  }

  /* ------------------------------ icônes ------------------------------ */
  const I = {
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6c.6 0 1.2.25 1.6.7l1.2 1.3h6.6A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8.5 13.5h7M8.5 16.5h5"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/></svg>',
    vid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M19 19v2H6"/></svg>',
    steth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/></svg>',
    pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.5 8.3l5 7.4" /></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 3h8l6 11-4 7H6l-4-7z"/><path d="M8 3l6 11H2M16 3l-6 11 4 7"/></svg>',
  };

  function fileKind(mime = "", name = "") {
    const n = name.toLowerCase();
    if (mime === Drive.FOLDER) return ["folder", "fi-folder", I.folder];
    if (mime.includes("pdf") || n.endsWith(".pdf")) return ["pdf", "fi-pdf", I.pdf];
    if (mime.includes("presentation") || mime.includes("powerpoint") || /\.pptx?$/.test(n)) return ["ppt", "fi-ppt", I.file];
    if (mime.includes("document") || mime.includes("word") || /\.docx?$/.test(n)) return ["doc", "fi-doc", I.file];
    if (mime.startsWith("image/")) return ["img", "fi-img", I.img];
    if (mime.startsWith("video/")) return ["vid", "fi-vid", I.vid];
    return ["other", "fi-other", I.file];
  }

  /* ------------------------------- modal ------------------------------ */
  const modal = $("#modal");
  function openModal(title, html, { wide = false, actions = "" } = {}) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = html;
    $("#modal-actions").innerHTML = actions;
    $(".modal-card", modal).classList.toggle("wide", wide);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const f = $("#modal-body input, #modal-body select, #modal-body textarea", modal);
    if (f && !wide) setTimeout(() => f.focus(), 30);
    return $("#modal-body");
  }
  function closeModal() {
    modal.hidden = true;
    $("#modal-body").innerHTML = "";
    document.body.style.overflow = "";
  }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  function confirmBox(message, okLabel = "Supprimer") {
    return new Promise((resolve) => {
      const body = openModal("Confirmation", `<p>${esc(message)}</p><div class="form-actions"><button class="btn btn-ghost" data-no>Annuler</button><button class="btn btn-danger" data-yes>${esc(okLabel)}</button></div>`);
      body.querySelector("[data-no]").onclick = () => { closeModal(); resolve(false); };
      body.querySelector("[data-yes]").onclick = () => { closeModal(); resolve(true); };
    });
  }

  function previewFile({ title, url, type, download, open }) {
    const acts = [
      download ? `<a class="btn btn-sm btn-soft" href="${esc(download)}" target="_blank" rel="noopener" download>${I.dl}<span>Télécharger</span></a>` : "",
      open ? `<a class="btn btn-sm btn-ghost" href="${esc(open)}" target="_blank" rel="noopener">${I.ext}<span>Ouvrir</span></a>` : "",
    ].join("");
    const body = type === "image"
      ? `<div class="img-view"><img src="${esc(safeUrl(url))}" alt="${esc(title)}"></div>`
      : `<iframe src="${esc(url)}" title="${esc(title)}" allow="autoplay"></iframe>`;
    openModal(title, body, { wide: true, actions: acts });
  }

  /* ------------------------------ upload UI --------------------------- */
  function dropzoneHtml(name, accept, label) {
    return `<div class="dropzone" data-dz="${name}" tabindex="0" role="button">
      <input type="file" name="${name}" accept="${accept}" hidden>
      <div data-dz-label>${I.dl.replace("M12 4v11M7 10l5 5 5-5", "M12 20V9M7 14l5-5 5 5")} <b>${label}</b><br><span class="small">ou glisse-dépose ici · max ${MAX_MB} Mo</span></div>
    </div>`;
  }
  function wireDropzones(root) {
    $$("[data-dz]", root).forEach((dz) => {
      const input = $("input[type=file]", dz);
      const label = $("[data-dz-label]", dz);
      const show = () => { const f = input.files[0]; if (f) label.innerHTML = `${I.file} <b>${esc(f.name)}</b><br><span class="small">${humanSize(f.size)} · cliquer pour changer</span>`; };
      dz.addEventListener("click", () => input.click());
      dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
      input.addEventListener("change", show);
      dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag"); });
      dz.addEventListener("dragleave", () => dz.classList.remove("drag"));
      dz.addEventListener("drop", (e) => {
        e.preventDefault(); dz.classList.remove("drag");
        if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; show(); }
      });
    });
  }
  function checkFile(f) {
    if (f && f.size > MAX_MB * 1024 * 1024) throw new Error(`Fichier trop volumineux (max ${MAX_MB} Mo).`);
  }
  async function withBusy(form, fn) {
    const btn = $("button[type=submit]", form);
    const err = $(".form-error", form);
    if (err) err.remove();
    const old = btn.innerHTML;
    btn.disabled = true; btn.textContent = "Envoi en cours…";
    try { await fn(); }
    catch (e) {
      console.error(e);
      form.insertAdjacentHTML("afterbegin", `<div class="form-error">${esc(e.message || e)}</div>`);
      btn.disabled = false; btn.innerHTML = old;
    }
  }

  function filiereOptions(sel) {
    return CFG.filieres.map((f) => `<option value="${f.id}" ${f.id === sel ? "selected" : ""}>${esc(f.nom)}</option>`).join("");
  }
  function anneeOptions(fid, sel) {
    const f = filiere(fid) || CFG.filieres[0];
    return f.annees.map((a) => `<option value="${a.annee}" ${String(a.annee) === String(sel) ? "selected" : ""}>${esc(a.label)}</option>`).join("");
  }
  function semOptions(fid, an, sel) {
    const a = anneeInfo(fid || CFG.filieres[0].id, an || 1) || (filiere(fid) || CFG.filieres[0]).annees[0];
    return a.semestres.map((x) => `<option value="${x.code}" ${x.code === sel ? "selected" : ""}>${x.code}</option>`).join("");
  }
  function wireFiliereAnnee(form) {
    const fs = $("[name=filiere]", form), as = $("[name=annee]", form), ss = $("[name=semestre]", form);
    const updSem = () => { if (ss) ss.innerHTML = semOptions(fs.value, as.value); };
    if (fs && as) fs.addEventListener("change", () => { as.innerHTML = anneeOptions(fs.value); updSem(); });
    if (as) as.addEventListener("change", updSem);
  }

  /* ------------------------------ formulaires ------------------------- */
  function newsForm(existing) {
    const n = existing || {};
    const body = openModal(existing ? "Modifier l'actualité" : "Nouvelle actualité", `
      <form class="form" novalidate>
        <div class="field"><label for="f-titre">Titre</label><input id="f-titre" class="input" name="titre" required maxlength="160" value="${esc(n.titre || "")}"></div>
        <div class="form-row">
          <div class="field"><label for="f-cat">Catégorie</label><select id="f-cat" class="input" name="categorie">${CATEGORIES.map((c) => `<option ${c === (n.categorie || "Info") ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="epingle" ${n.epingle ? "checked" : ""}> Épingler en haut</label></div>
        </div>
        <div class="field"><label for="f-contenu">Contenu</label><textarea id="f-contenu" class="input" name="contenu" placeholder="Écris ton annonce… (les liens deviennent cliquables)">${esc(n.contenu || "")}</textarea></div>
        <div class="field"><label>Image (facultatif)</label>${dropzoneHtml("image", "image/*", n.image_url ? "Remplacer l'image" : "Choisir une image")}</div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button type="submit" class="btn">${existing ? "Enregistrer" : "Publier"}</button></div>
      </form>`);
    const form = $("form", body);
    wireDropzones(form);
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const fd = new FormData(form);
        const titre = String(fd.get("titre")).trim();
        if (!titre) throw new Error("Le titre est obligatoire.");
        const row = { titre, categorie: fd.get("categorie"), contenu: String(fd.get("contenu")).trim(), epingle: !!fd.get("epingle") };
        const img = form.image.files[0];
        if (img) { checkFile(img); const up = await Store.upload(img, "actualites"); row.image_url = up.url; row.image_path = up.path; }
        if (existing) { if (img && existing.image_path) await Store.removeFile(existing.image_path); await Store.update("news", existing.id, row); }
        else await Store.insert("news", row);
        closeModal(); toast(existing ? "Actualité modifiée" : "Actualité publiée ✓"); route();
      });
    };
  }

  function planningForm(pre = {}) {
    const fid = pre.filiere || CFG.filieres[0].id;
    const body = openModal("Ajouter un planning", `
      <form class="form" novalidate>
        <div class="field"><label for="p-titre">Titre</label><input id="p-titre" class="input" name="titre" required placeholder="ex : Emploi du temps — Semaine 9" maxlength="160"></div>
        <div class="form-row">
          <div class="field"><label for="p-fil">Filière</label><select id="p-fil" class="input" name="filiere">${filiereOptions(fid)}</select></div>
          <div class="field"><label for="p-an">Année</label><select id="p-an" class="input" name="annee">${anneeOptions(fid, pre.annee)}</select></div>
        </div>
        <div class="field"><label for="p-per">Période (facultatif)</label><input id="p-per" class="input" name="periode" placeholder="ex : Semestre 1, Examens S1, Semaine du 3 nov." maxlength="80"></div>
        <div class="field"><label>Fichier du planning</label>${dropzoneHtml("fichier", "application/pdf,image/*", "Choisir un PDF ou une image")}<span class="hint">PDF, JPG, PNG… Une photo nette du planning affiché marche aussi.</span></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button type="submit" class="btn">Publier le planning</button></div>
      </form>`);
    const form = $("form", body);
    wireDropzones(form); wireFiliereAnnee(form);
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const fd = new FormData(form);
        const titre = String(fd.get("titre")).trim();
        const f = form.fichier.files[0];
        if (!titre) throw new Error("Le titre est obligatoire.");
        if (!f) throw new Error("Choisis le fichier du planning (PDF ou image).");
        checkFile(f);
        const isImg = (f.type || "").startsWith("image/");
        if (!isImg && !/pdf/.test(f.type) && !/\.pdf$/i.test(f.name)) throw new Error("Format accepté : PDF ou image.");
        const up = await Store.upload(f, "plannings");
        await Store.insert("plannings", {
          titre, filiere: fd.get("filiere"), annee: Number(fd.get("annee")), periode: String(fd.get("periode")).trim() || null,
          fichier_url: up.url, fichier_path: up.path, type: isImg ? "image" : "pdf",
        });
        closeModal(); toast("Planning publié ✓"); route();
      });
    };
  }

  async function lessonForm(pre = {}) {
    const fid = pre.filiere || CFG.filieres[0].id;
    // Suggestions de modules : modules déjà utilisés + dossiers du Drive de l'année
    let modules = [];
    try {
      const rows = await Store.list("lessons", {});
      modules = rows.map((r) => r.module);
      const did = pre.annee && pre.semestre ? driveIdFor(fid, pre.annee, pre.semestre) : "";
      if (did && Drive.canList(did)) {
        const items = await Drive.list(did);
        modules = modules.concat(items.filter((i) => i.mimeType === Drive.FOLDER).map((i) => i.name));
      }
    } catch (e) {}
    modules = Array.from(new Set(modules)).sort((a, b) => a.localeCompare(b, "fr"));

    const body = openModal("Ajouter une leçon", `
      <form class="form" novalidate>
        <div class="form-row">
          <div class="field"><label for="l-fil">Filière</label><select id="l-fil" class="input" name="filiere">${filiereOptions(fid)}</select></div>
          <div class="field"><label for="l-an">Année</label><select id="l-an" class="input" name="annee">${anneeOptions(fid, pre.annee)}</select></div>
        </div>
        <div class="field"><label for="l-sem">Semestre</label><select id="l-sem" class="input" name="semestre">${semOptions(fid, pre.annee, pre.semestre)}</select></div>
        <div class="field"><label for="l-mod">Module / matière</label><input id="l-mod" class="input" name="module" list="l-mods" required placeholder="ex : Anatomie" value="${esc(pre.module || "")}" maxlength="80"><datalist id="l-mods">${modules.map((m) => `<option value="${esc(m)}">`).join("")}</datalist></div>
        <div class="field"><label for="l-titre">Titre de la leçon</label><input id="l-titre" class="input" name="titre" required placeholder="ex : Cours 3 — Le cœur" maxlength="160"></div>
        <div class="field"><label for="l-desc">Description (facultatif)</label><input id="l-desc" class="input" name="description" maxlength="240" placeholder="ex : Diapos du Pr X, version 2025"></div>
        <div class="field"><label>Fichier</label>${dropzoneHtml("fichier", ".pdf,.ppt,.pptx,.doc,.docx,image/*,video/*", "Choisir un fichier (PDF, PPT, image…)")}</div>
        <div class="or-sep">— ou —</div>
        <div class="field"><label for="l-lien">Lien (Drive, YouTube…)</label><input id="l-lien" class="input" name="lien" type="url" placeholder="https://"></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button type="submit" class="btn">Ajouter la leçon</button></div>
      </form>`);
    const form = $("form", body);
    wireDropzones(form); wireFiliereAnnee(form);
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const fd = new FormData(form);
        const row = {
          filiere: fd.get("filiere"), annee: Number(fd.get("annee")), semestre: fd.get("semestre") || null,
          module: String(fd.get("module")).trim(), titre: String(fd.get("titre")).trim(),
          description: String(fd.get("description")).trim() || null, lien: String(fd.get("lien")).trim() || null,
        };
        if (!row.module || !row.titre) throw new Error("Le module et le titre sont obligatoires.");
        const f = form.fichier.files[0];
        if (!f && !row.lien) throw new Error("Ajoute un fichier ou un lien.");
        if (row.lien && !/^https?:\/\//i.test(row.lien)) throw new Error("Le lien doit commencer par https://");
        if (f) { checkFile(f); const up = await Store.upload(f, `lecons/${row.filiere}-${row.annee}`); row.fichier_url = up.url; row.fichier_path = up.path; }
        await Store.insert("lessons", row);
        closeModal(); toast("Leçon ajoutée ✓"); route();
      });
    };
  }

  function loginForm(start = "in") {
    const body = openModal(start === "up" ? "Créer un compte" : "Connexion", `
      <div class="tabs"><button data-tab="in" class="${start === "in" ? "active" : ""}">Connexion</button><button data-tab="up" class="${start === "up" ? "active" : ""}">Créer un compte</button></div>
      ${Store.demo ? '<p class="small muted">Aperçu : n\'importe quel email/mot de passe te connecte en tant qu\'admin.</p>' : '<p class="small muted">Compte gratuit, réservé aux étudiants. Après inscription, l\'admin peut te nommer « éditeur » pour publier.</p>'}
      <form class="form" novalidate>
        <div class="form-row" data-only="up" ${start === "up" ? "" : "hidden"}>
          <div class="field"><label for="a-prenom">Prénom</label><input id="a-prenom" class="input" name="prenom" maxlength="40" autocomplete="given-name"></div>
          <div class="field"><label for="a-nom">Nom</label><input id="a-nom" class="input" name="nom" maxlength="40" autocomplete="family-name"></div>
        </div>
        <div class="field"><label for="a-email">Email</label><input id="a-email" class="input" type="email" name="email" required autocomplete="email"></div>
        <div class="field"><label for="a-pw">Mot de passe</label><input id="a-pw" class="input" type="password" name="pw" required minlength="6" autocomplete="${start === "up" ? "new-password" : "current-password"}"></div>
        <div class="form-actions" style="justify-content:space-between;align-items:center">
          <button type="button" class="link-btn" data-only="in" ${start === "up" ? "hidden" : ""} id="forgot">Mot de passe oublié ?</button>
          <button type="submit" class="btn">${start === "up" ? "Créer mon compte" : "Se connecter"}</button>
        </div>
      </form>`);
    let mode = start;
    const form = $("form", body);
    $$(".tabs button", body).forEach((b) => b.onclick = () => {
      mode = b.dataset.tab;
      $$(".tabs button", body).forEach((x) => x.classList.toggle("active", x === b));
      $$("[data-only=up]", body).forEach((x) => (x.hidden = mode !== "up"));
      $$("[data-only=in]", body).forEach((x) => (x.hidden = mode !== "in"));
      $("button[type=submit]", form).textContent = mode === "up" ? "Créer mon compte" : "Se connecter";
      $("#a-pw").autocomplete = mode === "up" ? "new-password" : "current-password";
    });
    $("#forgot", body).onclick = () => forgotForm(form.email.value.trim());
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const email = form.email.value.trim(), pw = form.pw.value;
        if (!email || !pw) throw new Error("Email et mot de passe requis.");
        if (mode === "up") {
          if (pw.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
          const prenom = form.prenom.value.trim(), nomF = form.nom.value.trim();
          if (!prenom || !nomF) throw new Error("Entre ton prénom et ton nom.");
          const r = await Store.signUp(email, pw, `${prenom} ${nomF}`);
          closeModal();
          if (r.confirm) { toast("Compte créé ! Confirme ton email puis connecte-toi."); return; }
          toast("Compte créé ✓");
        } else {
          await Store.signIn(email, pw);
          closeModal(); toast("Connecté ✓");
        }
      });
    };
  }

  function forgotForm(email = "") {
    const body = openModal("Mot de passe oublié", `
      <p class="small muted">Entre ton email : tu recevras un lien pour choisir un nouveau mot de passe. Personne, pas même l'administrateur, ne peut voir ton ancien mot de passe.</p>
      <form class="form" novalidate>
        <div class="field"><label for="fp-email">Email</label><input id="fp-email" class="input" type="email" name="email" required value="${esc(email)}" autocomplete="email"></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Annuler</button><button type="submit" class="btn">Envoyer le lien</button></div>
      </form>`);
    const form = $("form", body);
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const em = form.email.value.trim();
        if (!em) throw new Error("Entre ton email.");
        await Store.resetPassword(em);
        closeModal(); toast("Lien envoyé ! Regarde ta boîte mail.");
      });
    };
  }

  function newPasswordForm() {
    const body = openModal("Nouveau mot de passe", `
      <p class="small muted">Choisis un nouveau mot de passe pour ton compte.</p>
      <form class="form" novalidate>
        <div class="field"><label for="np-pw">Nouveau mot de passe</label><input id="np-pw" class="input" type="password" name="pw" required minlength="6" autocomplete="new-password"></div>
        <div class="field"><label for="np-pw2">Confirme</label><input id="np-pw2" class="input" type="password" name="pw2" required minlength="6" autocomplete="new-password"></div>
        <div class="form-actions"><button type="submit" class="btn">Enregistrer</button></div>
      </form>`);
    const form = $("form", body);
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const pw = form.pw.value, pw2 = form.pw2.value;
        if (pw.length < 6) throw new Error("Au moins 6 caractères.");
        if (pw !== pw2) throw new Error("Les deux mots de passe ne correspondent pas.");
        await Store.updatePassword(pw);
        closeModal(); toast("Mot de passe modifié ✓");
      });
    };
  }

  function pageConfidentialite() {
    main.innerHTML = `<div style="max-width:760px">
      <h1>Confidentialité</h1>
      <p class="muted">Ce que le site ${esc(CFG.nomSite)} enregistre, et ce qu'il n'enregistre pas.</p>
      <div class="card card-pad" style="margin-top:14px">
        <h3>Ce qui est enregistré</h3>
        <ul>
          <li>Ton <b>email</b> et le <b>nom affiché</b> que tu choisis, pour créer ton compte.</li>
          <li>La <b>date de création</b> du compte et la <b>date de dernière connexion</b>.</li>
          <li>Le <b>contenu que tu publies</b> si tu es éditeur (actualités, plannings, leçons).</li>
          <li>Un <b>comptage anonyme des visites</b> (nombre de pages vues), sans identifier qui que ce soit.</li>
        </ul>
        <h3>Ce qui n'est PAS enregistré</h3>
        <ul>
          <li>Ton <b>mot de passe</b> n'est jamais lisible : il est chiffré, personne ne peut le voir.</li>
          <li>Ta <b>position</b> ou ta localisation précise.</li>
          <li>Aucune donnée n'est vendue ni partagée avec des tiers.</li>
        </ul>
        <h3>Tes droits</h3>
        <p>Tu peux demander à tout moment la suppression de ton compte et de tes données à l'administrateur du site. Conformément à la loi 09-08 (Maroc) sur la protection des données personnelles.</p>
      </div>
    </div>`;
  }

  /* --------------------------- composants ----------------------------- */
  function newsCard(n, { clamp = false } = {}) {
    const edit = isEditor() ? `<div class="row-actions"><button class="btn btn-sm btn-ghost" data-edit-news="${n.id}">${I.edit} Modifier</button><button class="btn btn-sm btn-danger" data-del="news:${n.id}">${I.trash} Supprimer</button></div>` : "";
    return `<article class="card news ${n.epingle ? "pinned" : ""}">
      <div class="news-meta">
        ${n.epingle ? '<span class="badge b-pin">Épinglé</span>' : ""}
        <span class="badge b-${esc(n.categorie)}">${esc(n.categorie)}</span>
        <span title="${esc(fmtDate(n.created_at))}">${timeAgo(n.created_at)}</span>
        ${n.auteur_nom ? `<span>· ${esc(n.auteur_nom)}</span>` : ""}
      </div>
      <h3>${esc(n.titre)}</h3>
      ${n.image_url && !clamp ? `<img class="news-img" src="${esc(safeUrl(n.image_url))}" alt="" loading="lazy">` : ""}
      ${n.contenu ? `<div class="news-body ${clamp ? "clamp" : ""}">${linkify(n.contenu)}</div>` : ""}
      ${clamp ? "" : edit}
    </article>`;
  }

  function planningCard(p) {
    const f = filiere(p.filiere);
    const thumb = p.type === "image"
      ? `<img src="${esc(safeUrl(p.fichier_url))}" alt="Aperçu : ${esc(p.titre)}" loading="lazy">`
      : `<div class="pdf">${I.pdf}<span>PDF</span></div>`;
    return `<article class="card plan">
      <div class="plan-thumb" data-view-plan="${p.id}">${thumb}</div>
      <div class="plan-body">
        <div class="news-meta"><span class="badge" style="background:${f ? f.couleur : "#999"}1f;color:${f ? f.couleur : "inherit"}">${esc(f ? f.nom : p.filiere)} · ${esc(anneeLabel(p.filiere, p.annee))}</span>${p.periode ? `<span>${esc(p.periode)}</span>` : ""}</div>
        <h3>${esc(p.titre)}</h3>
        <div class="small muted">Publié ${timeAgo(p.created_at)}${p.auteur_nom ? " par " + esc(p.auteur_nom) : ""}</div>
        <div class="plan-foot">
          <button class="btn btn-sm btn-soft" data-view-plan="${p.id}">${I.eye} Voir</button>
          <a class="btn btn-sm btn-ghost" href="${esc(safeUrl(p.fichier_url))}" target="_blank" rel="noopener" download>${I.dl} Télécharger</a>
          ${isEditor() ? `<button class="btn btn-sm btn-danger" data-del="plannings:${p.id}" title="Supprimer">${I.trash}</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  function emptyState(title, text, icon = I.book) {
    return `<div class="empty">${icon}<h3>${esc(title)}</h3><p>${text}</p></div>`;
  }

  // Cache des lignes chargées (pour boutons Voir / Modifier / Supprimer)
  const rowsCache = { news: new Map(), plannings: new Map(), lessons: new Map() };
  const remember = (table, rows) => { rows.forEach((r) => rowsCache[table].set(String(r.id), r)); return rows; };

  /* ------------------------------- pages ------------------------------ */
  async function pageAccueil() {
    const [news, plans] = await Promise.all([
      Store.list("news").then((r) => remember("news", r)),
      Store.list("plannings").then((r) => remember("plannings", r)),
    ]);
    const sortedNews = news.slice().sort((a, b) => (b.epingle - a.epingle) || b.created_at.localeCompare(a.created_at));
    main.innerHTML = `
      <section class="hero">
        <svg class="hero-deco" viewBox="0 0 100 100"><path d="M38 8h24v30h30v24H62v30H38V62H8V38h30z" fill="#fff"/></svg>
        <span class="fac">${I.steth.replace("<svg", '<svg width="16" height="16"')} ${esc(CFG.faculte)}</span>
        <h1>Tous tes cours, plannings et annonces au même endroit</h1>
        <p>${esc(CFG.slogan)} Les leçons suivent l'organisation du Drive, classées par filière, année et semestre.</p>
        <div class="hero-actions">
          <a class="btn" href="#/lecons">${I.book} Voir les leçons</a>
          <a class="btn btn-ghost" href="#/planning">${I.cal} Planning</a>
        </div>
      </section>

      <div class="quick">
        <a class="card" href="#/actualites"><span class="ico" style="background:var(--info-50);color:var(--info)">${I.news}</span><span><b>Actualités</b><small>${news.length} annonce${news.length > 1 ? "s" : ""}</small></span></a>
        <a class="card" href="#/planning"><span class="ico" style="background:var(--warn-50);color:var(--warn)">${I.cal}</span><span><b>Plannings</b><small>${plans.length} document${plans.length > 1 ? "s" : ""}</small></span></a>
        <a class="card" href="#/lecons"><span class="ico" style="background:var(--primary-50);color:var(--primary)">${I.book}</span><span><b>Leçons</b><small>${CFG.filieres.map((f) => f.nom).join(" · ")}</small></span></a>
      </div>

      <section class="section">
        <div class="section-head"><h2>Choisis ton année</h2></div>
        <div class="grid grid-2">${CFG.filieres.map(filiereCard).join("")}</div>
      </section>

      <section class="section grid grid-2" style="align-items:start">
        <div>
          <div class="section-head"><h2>Dernières actualités</h2><a href="#/actualites" class="small">Tout voir →</a></div>
          <div class="news-list">${sortedNews.slice(0, 3).map((n) => newsCard(n, { clamp: true })).join("") || emptyState("Aucune actualité", "Les annonces apparaîtront ici.", I.news)}</div>
        </div>
        <div>
          <div class="section-head"><h2>Derniers plannings</h2><a href="#/planning" class="small">Tout voir →</a></div>
          <div class="grid">${plans.slice(0, 2).map(planningCard).join("") || emptyState("Aucun planning", "Les emplois du temps apparaîtront ici.", I.cal)}</div>
        </div>
      </section>`;
  }

  function filiereCard(f) {
    return `<div class="card filiere-card">
      <div class="filiere-head"><span class="filiere-dot" style="background:${f.couleur}">${f.id === "pharmacie" ? I.pill : I.steth}</span><div><h3 style="margin:0">${esc(f.nom)}</h3><span class="small muted">${f.annees.length} années · ${f.annees.length * 2} semestres</span></div></div>
      <div class="years" style="--fc:${f.couleur}">
        ${f.annees.map((a) => { const lk = Store.user() && !window.aAnnee(Store.user(), f.id, a.annee); return `<a class="year ${a.semestres.some((x) => x.drive) ? "has" : ""} ${lk ? "locked" : ""}" href="#/lecons/${f.id}/${a.annee}"${lk ? ' title="Année verrouillée"' : ""}>${lk ? `<span class="year-lock">${I.lock}</span>` : ""}<b>${a.annee}</b><span>${esc(a.label)}</span>
          <span class="sems">${a.semestres.map((x) => `<i class="${x.drive ? "on" : ""}" title="${x.drive ? "Cours disponibles" : "Bientôt"}">${x.code}</i>`).join("")}</span></a>`; }).join("")}
      </div>
    </div>`;
  }

  async function pageActualites(params) {
    const cat = params.get("cat") || "";
    const all = remember("news", await Store.list("news"));
    const list = all.filter((n) => !cat || n.categorie === cat)
      .sort((a, b) => (b.epingle - a.epingle) || b.created_at.localeCompare(a.created_at));
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Actualités</h1><p>Annonces de la faculté, examens, cours et événements.</p></div>
        ${isEditor() ? `<button class="btn" data-action="new-news">${I.plus} Nouvelle actualité</button>` : ""}
      </div>
      <div class="chips" style="margin-bottom:18px">
        <a class="chip ${!cat ? "active" : ""}" href="#/actualites">Toutes</a>
        ${CATEGORIES.map((c) => `<a class="chip ${cat === c ? "active" : ""}" href="#/actualites?cat=${encodeURIComponent(c)}">${c}</a>`).join("")}
      </div>
      <div class="news-list" style="max-width:820px">${list.map((n) => newsCard(n)).join("") || emptyState("Aucune actualité", cat ? "Rien dans cette catégorie pour l'instant." : "Les annonces apparaîtront ici.", I.news)}</div>`;
  }

  async function pagePlanning(params) {
    const fil = params.get("filiere") || "";
    const an = params.get("annee") || "";
    const list = remember("plannings", await Store.list("plannings", { filiere: fil, annee: an }));
    const f = filiere(fil);
    main.innerHTML = `
      <div class="page-head">
        <div><h1>Planning</h1><p>Emplois du temps, calendriers d'examens et de TP.</p></div>
        ${isEditor() ? `<button class="btn" data-action="new-planning">${I.plus} Ajouter un planning</button>` : ""}
      </div>
      <div class="toolbar">
        <select class="input" id="pf-fil" aria-label="Filière"><option value="">Toutes les filières</option>${filiereOptions(fil)}</select>
        <select class="input" id="pf-an" aria-label="Année" ${f ? "" : "disabled"}><option value="">Toutes les années</option>${f ? anneeOptions(fil, an) : ""}</select>
      </div>
      <div class="grid grid-3">${list.map(planningCard).join("")}</div>
      ${list.length ? "" : emptyState("Aucun planning", "Aucun planning publié pour cette sélection.", I.cal)}`;
    const upd = () => {
      const p = new URLSearchParams();
      const fv = $("#pf-fil").value, av = $("#pf-an").value;
      if (fv) p.set("filiere", fv);
      if (fv && av && fv === fil) p.set("annee", av);
      location.hash = "#/planning" + (p.toString() ? "?" + p : "");
    };
    $("#pf-fil").onchange = upd; $("#pf-an").onchange = upd;
  }

  async function pageLecons(parts) {
    const [fid, an, sem, ...path] = parts;
    if (!fid) return lessonsHome();
    const f = filiere(fid);
    if (!f) return notFound();
    if (!an) {
      main.innerHTML = `<div class="crumbs"><a href="#/lecons">Leçons</a><span class="sep">/</span><span class="cur">${esc(f.nom)}</span></div>
        <div class="grid">${filiereCard(f)}</div>`;
      return;
    }
    const a = anneeInfo(fid, an);
    if (!a) return notFound();
    if (!window.aAnnee(Store.user(), f.id, a.annee)) return paywallPage(f.id, a.annee, true);
    const s = sem && a.semestres.find((x) => x.code === sem);
    if (!s) { location.replace(`#/lecons/${fid}/${a.annee}/${defaultSem(a)}`); return; }
    return semPage(f, a, s, path);
  }

  function lessonsHome() {
    main.innerHTML = `
      <div class="page-head"><div><h1>Leçons</h1><p>Organisées comme le Drive : filière → année → semestre → module.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isEditor() ? `<button class="btn" data-action="new-lesson">${I.plus} Ajouter une leçon</button>` : ""}
        </div>
      </div>
      <div class="grid grid-2">${CFG.filieres.map(filiereCard).join("")}</div>`;
  }

  const prettyName = (n) => n.charAt(0).toUpperCase() + n.slice(1);
  const kindLabel = { pdf: "PDF", ppt: "PowerPoint", doc: "Document", img: "Image", vid: "Vidéo", other: "Fichier" };

  async function semPage(f, a, s, path) {
    const base = `#/lecons/${f.id}/${a.annee}/${s.code}`;
    const rootId = s.drive;
    const currentId = path.length ? path[path.length - 1] : rootId;

    let crumbs = `<a href="#/lecons">Leçons</a><span class="sep">/</span><a href="#/lecons/${f.id}">${esc(f.nom)}</a><span class="sep">/</span><span>${esc(a.label)}</span><span class="sep">/</span>`;
    crumbs += path.length ? `<a href="${base}">${s.code}</a>` : `<span class="cur">${s.code}</span>`;
    let folderName = "";
    if (path.length) {
      const names = await Promise.all(path.map((id) => Drive.name(id)));
      folderName = names[names.length - 1];
      names.forEach((nm, i) => {
        crumbs += `<span class="sep">/</span>`;
        crumbs += i === path.length - 1 ? `<span class="cur" data-i18n-skip>${esc(nm)}</span>` : `<a href="${base}/${path.slice(0, i + 1).join("/")}" data-i18n-skip>${esc(nm)}</a>`;
      });
    }

    main.innerHTML = `
      <div class="crumbs">${crumbs}</div>
      <div class="year-head">
        <span class="filiere-dot" style="background:${f.couleur}">${a.annee}</span>
        <div class="grow"><h1>${esc(f.nom)} — ${esc(a.label)}</h1><span class="muted small">Semestre ${s.code} · ${esc(CFG.faculte)}</span></div>
        ${isEditor() ? `<button class="btn" data-action="new-lesson" data-filiere="${f.id}" data-annee="${a.annee}" data-semestre="${s.code}">${I.plus} Ajouter une leçon</button>` : ""}
      </div>
      <div class="year-nav">
        <div class="chips" aria-label="Années">${f.annees.map((x) => `<a class="chip ${x.annee === a.annee ? "active" : ""}" href="#/lecons/${f.id}/${x.annee}">${x.annee}<span class="chip-sub" data-i18n-skip>${ordinal(x.annee)}</span></a>`).join("")}</div>
        <div class="seg" role="tablist" aria-label="Semestres">${a.semestres.map((x) => `<a role="tab" class="${x.code === s.code ? "active" : ""}" href="#/lecons/${f.id}/${a.annee}/${x.code}" aria-selected="${x.code === s.code}">${x.code}${x.drive ? "" : '<span class="seg-off">·</span>'}</a>`).join("")}</div>
      </div>
      <div id="drive-zone"><div class="spinner"></div></div>
      ${!path.length ? `<section id="added" class="section"></section>` : ""}`;

    if (!path.length) {
      const added = remember("lessons", await Store.list("lessons", { filiere: f.id, annee: a.annee }))
        .filter((l) => !l.semestre || l.semestre === s.code);
      renderAdded(added, f, a, s);
    }

    const zone = $("#drive-zone");
    if (!rootId) {
      zone.innerHTML = emptyState(`Les cours du ${s.code} arrivent bientôt`, isAdmin()
        ? `Ajoute l'ID du dossier Drive du ${s.code} dans <code>js/config.js</code>, ou envoie le lien à Claude.`
        : "Ce semestre n'est pas encore relié au Drive.", I.drive);
      return;
    }
    if (!Drive.canList(currentId)) {
      // Jamais d'affichage direct du Drive : seule la liste protégée (importée par l'admin) est montrée
      zone.innerHTML = emptyState("Liste des cours pas encore disponible", isAdmin()
        ? `Importe le fichier <code>drive-import.json</code> dans <a href="#/admin?tab=drive">Espace admin → Liaison Drive</a>.`
        : "Les cours de ce semestre arrivent bientôt. Reviens un peu plus tard.", I.drive);
      return;
    }
    let items;
    try { items = await Drive.list(currentId); }
    catch (e) {
      zone.innerHTML = emptyState("Impossible de lire le Drive", esc(e.message) + "<br>Vérifie que le dossier est partagé « Tous les utilisateurs disposant du lien ».", I.drive);
      return;
    }
    const PRATIQUE = /calendrier|diffusion|exam|planning|emploi du temps|annonce|\bSN\b/i;
    const folders = items.filter((i) => i.mimeType === Drive.FOLDER && !(path.length === 0 && PRATIQUE.test(i.name)));
    const pratique = path.length ? [] : items.filter((i) => i.mimeType === Drive.FOLDER && PRATIQUE.test(i.name));
    const files = items.filter((i) => i.mimeType !== Drive.FOLDER);

    if (!path.length) {
      // Racine du semestre : modules en cartes + recherche globale
      const searchable = Drive.canSearch(rootId);
      zone.innerHTML = `
        ${searchable ? `<div class="search-bar">${I.search}<input class="input" type="search" id="sem-search" placeholder="Rechercher dans le ${s.code} : thalamus, ECG, QCM…" aria-label="Rechercher un cours" autocomplete="off"></div>` : ""}
        <div id="sem-results" hidden></div>
        <div id="sem-browse">
          <div class="section-head"><h2>Modules</h2><span class="muted small">${folders.length} module${folders.length > 1 ? "s" : ""}</span></div>
          <div class="modules">${folders.map((m) => moduleCard(m, base)).join("")}</div>
          ${pratique.length ? `<div class="section-head" style="margin-top:26px"><h2>Infos du semestre</h2><span class="muted small">Examens, calendrier, diffusions</span></div>
          <div class="modules">${pratique.map((m) => moduleCard(m, base, true)).join("")}</div>` : ""}
          ${files.length ? `<div class="section-head" style="margin-top:22px"><h2>Fichiers</h2></div><section class="card explorer"><ul class="items">${files.map((it) => driveItem(it, base, path)).join("")}</ul></section>` : ""}
        </div>`;
      if (searchable) {
        const input = $("#sem-search"), res = $("#sem-results"), browse = $("#sem-browse");
        input.addEventListener("input", () => {
          const q = input.value.trim();
          if (q.length < 2) { res.hidden = true; browse.hidden = false; return; }
          const found = Drive.search(rootId, q);
          res.hidden = false; browse.hidden = true;
          res.innerHTML = found.length
            ? `<div class="section-head"><h2>${found.length}${found.length === 200 ? "+" : ""} résultat${found.length > 1 ? "s" : ""}</h2></div>
               <section class="card explorer"><ul class="items">${found.map((it) => driveItem(it, base, path, it.path)).join("")}</ul></section>`
            : emptyState("Aucun résultat", `Rien ne correspond à « ${esc(q)} » dans le ${s.code}.`, I.search);
        });
      }
      return;
    }

    // Sous-dossier : liste
    zone.innerHTML = `
      <section class="card explorer">
        <div class="explorer-head">
          <a class="icon-btn" href="${path.length > 1 ? base + "/" + path.slice(0, -1).join("/") : base}" title="Dossier parent" aria-label="Dossier parent">${I.back}</a>
          <b class="explorer-title">${esc(folderName)}</b>
          ${items.length > 8 ? `<input class="input" type="search" id="ex-filter" placeholder="Filtrer ${items.length} éléments…" aria-label="Filtrer">` : `<span class="muted small">${items.length} élément${items.length > 1 ? "s" : ""}</span>`}
        </div>
        <ul class="items" id="ex-items">${items.map((it) => driveItem(it, base, path)).join("") || `<li class="card-pad muted">Ce dossier est vide pour l'instant.</li>`}</ul>
      </section>`;
    const filter = $("#ex-filter");
    if (filter) filter.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      $$("#ex-items > li").forEach((li) => {
        const n = (li.dataset.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        li.hidden = !!q && !n.includes(q);
      });
    });
  }

  function moduleCard(m, base, info = false) {
    const n = Drive.countFiles(m.id);
    const sub = Drive.live() ? "" : (n === null ? "" : n ? `${n} fichier${n > 1 ? "s" : ""}` : "Vide pour l'instant");
    return `<a class="module" href="${base}/${m.id}">
      <span class="fi ${info ? "fi-doc" : "fi-folder"}">${info ? I.cal : I.book}</span>
      <span class="nm"><b>${esc(prettyName(m.name))}</b>${sub ? `<small>${sub}</small>` : ""}</span>
      <span class="chev" aria-hidden="true">›</span>
    </a>`;
  }

  function driveItem(it, base, path, searchPath) {
    const [kind, cls, icon] = fileKind(it.mimeType, it.name);
    if (kind === "folder") {
      const n = Drive.countFiles(it.id);
      return `<li class="item" data-name="${esc(it.name)}"><a class="item-link" href="${base}/${[...path, it.id].join("/")}">
        <span class="fi ${cls}">${icon}</span><span class="nm"><b>${esc(it.name)}</b><small>Dossier${n !== null && !Drive.live() ? ` · ${n} fichier${n > 1 ? "s" : ""}` : ""}</small></span></a></li>`;
    }
    const meta = searchPath && searchPath.length
      ? searchPath.map((p) => esc(prettyName(p.name))).join(" › ")
      : [kindLabel[kind] || "Fichier", humanSize(it.size), it.modifiedTime ? "modifié " + timeAgo(it.modifiedTime) : ""].filter(Boolean).join(" · ");
    const isNative = (it.mimeType || "").startsWith("application/vnd.google-apps");
    return `<li class="item" data-name="${esc(it.name)}">
      <a class="item-link" href="#/fichier/${esc(it.id)}" title="Ouvrir">
        <span class="fi ${cls}">${icon}</span><span class="nm"><b>${esc(it.name)}</b><small>${meta}</small></span></a>
      <span class="acts">${isNative ? "" : `<a class="icon-btn" href="${esc(Drive.downloadUrl(it))}" target="_blank" rel="noopener" title="Télécharger" aria-label="Télécharger ${esc(it.name)}">${I.dl}</a>`}</span></li>`;
  }

  function renderAdded(added, f, a, s) {
    const box = $("#added");
    if (!box) return;
    if (!added.length && !isEditor()) { box.remove(); return; }
    const groups = {};
    added.forEach((l) => (groups[l.module] = groups[l.module] || []).push(l));
    const mods = Object.keys(groups).sort((x, y) => x.localeCompare(y, "fr"));
    box.innerHTML = `
      <div class="section-head"><h2>Ajouts de la promo</h2>${isEditor() ? `<button class="btn btn-sm btn-soft" data-action="new-lesson" data-filiere="${f.id}" data-annee="${a.annee}" data-semestre="${s.code}">${I.plus} Ajouter</button>` : ""}</div>
      ${mods.length ? `<div class="card" style="padding:10px 6px">${mods.map((m) => `
        <div class="module-group"><h4>${esc(m)}</h4><ul class="items" style="padding:0">
          ${groups[m].map((l) => {
            const [, cls, icon] = l.fichier_url ? fileKind("", l.fichier_url) : ["link", "fi-doc", I.link];
            const url = l.fichier_url || l.lien;
            return `<li class="item">
              <a class="item-link" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">
                <span class="fi ${cls}">${icon}</span>
                <span class="nm"><b>${esc(l.titre)}</b><small>${esc(l.description || "")}${l.description ? " · " : ""}${timeAgo(l.created_at)}${l.auteur_nom ? " · " + esc(l.auteur_nom) : ""}</small></span></a>
              <span class="acts">
                ${l.fichier_url && /\.(pdf|png|jpe?g|gif|webp)(\?|$)/i.test(l.fichier_url) ? `<button class="icon-btn" data-view-lesson="${l.id}" title="Aperçu">${I.eye}</button>` : ""}
                ${isEditor() ? `<button class="icon-btn" data-del="lessons:${l.id}" title="Supprimer" style="color:var(--danger)">${I.trash}</button>` : ""}
              </span></li>`;
          }).join("")}
        </ul></div>`).join("")}</div>`
      : emptyState("Aucun ajout pour l'instant", "Les éditeurs peuvent ajouter des résumés, QCM ou liens. Ils apparaîtront ici, classés par module.")}`;
  }

  async function pageAdmin(params) {
    const u = Store.user();
    if (!u) {
      main.innerHTML = emptyState("Espace réservé", `Connecte-toi pour publier du contenu.<br><br><button class="btn" data-action="login">Connexion</button>`, I.users);
      return;
    }
    if (!isEditor()) {
      main.innerHTML = emptyState("Compte en attente", `Ton compte (${esc(u.email)}) est en lecture seule.<br>Demande à l'admin principal de te nommer <b>éditeur</b>.`, I.users);
      return;
    }
    const tab = params.get("tab") || "contenus";
    main.innerHTML = `
      <div class="page-head"><div><h1>Espace admin</h1><p>Connecté en tant que <b>${esc(u.nom)}</b> · ${roleLabel(u.role)}</p></div></div>
      <div class="admin-actions">
        <button data-action="new-news"><span class="ico" style="background:var(--info-50);color:var(--info)">${I.news}</span><span><b>Publier une actualité</b><small>Annonce, examen, événement…</small></span></button>
        <button data-action="new-planning"><span class="ico" style="background:var(--warn-50);color:var(--warn)">${I.cal}</span><span><b>Ajouter un planning</b><small>PDF ou image</small></span></button>
        <button data-action="new-lesson"><span class="ico" style="background:var(--primary-50);color:var(--primary)">${I.book}</span><span><b>Ajouter une leçon</b><small>Fichier ou lien, par année/module</small></span></button>
      </div>
      <section class="section">
        <div class="tabs">
          <button data-admin-tab="contenus" class="${tab === "contenus" ? "active" : ""}">Contenus publiés</button>
          ${isAdmin() ? `<button data-admin-tab="membres" class="${tab === "membres" ? "active" : ""}">Membres & rôles</button>
          <button data-admin-tab="drive" class="${tab === "drive" ? "active" : ""}">Liaison Drive</button>` : ""}
        </div>
        <div id="admin-tab"><div class="spinner"></div></div>
      </section>`;
    $$("[data-admin-tab]").forEach((b) => (b.onclick = () => (location.hash = "#/admin?tab=" + b.dataset.adminTab)));
    const box = $("#admin-tab");

    if (tab === "membres" && isAdmin()) {
      const [members, stats] = await Promise.all([Store.members(), Store.statsVisites()]);
      const info = (m) => window.accesInfo(m.email, m.role, m.acces_list, m.demandes_list, { filiere: m.filiere_choisie, annee: m.annee_choisie });
      const nbDem = members.reduce((n, m) => n + (m.demandes_list || []).length, 0);
      const nbAnn = members.reduce((n, m) => n + info(m).annees.length, 0);
      members.sort((x, y) => ((y.demandes_list || []).length > 0) - ((x.demandes_list || []).length > 0));
      const fin = window.finAnneeUniv();
      const optsAnnees = CFG.filieres.flatMap((f) => f.annees.map((a) => `<option value="${f.id}:${a.annee}">${esc(f.nom)} · ${esc(a.label)}</option>`)).join("");
      box.innerHTML = `
        <div class="grid stats-4" style="margin-bottom:16px">
          <div class="card card-pad"><small class="muted">Comptes</small><div class="stat-big">${members.length}</div><small class="muted">${members.filter((m) => m.actif !== false).length} actifs</small></div>
          <div class="card card-pad ${nbDem ? "stat-alert" : ""}"><small class="muted">Paiements à vérifier</small><div class="stat-big">${nbDem}</div><small class="muted">${nbAnn} années payées en cours</small></div>
          <div class="card card-pad"><small class="muted">Visites (7 jours)</small><div class="stat-big">${stats.semaine ?? 0}</div><small class="muted">${stats.jour ?? 0} aujourd'hui</small></div>
          <div class="card card-pad"><small class="muted">Visites (total)</small><div class="stat-big">${stats.total ?? 0}</div><small class="muted">pages vues</small></div>
        </div>
        <p class="small muted">Les emails <b>@${esc(CFG.domaineGratuit || "etu.univh2c.ma")}</b> choisissent une année gratuite (modifiable). Pour les autres, chaque année payée reste ouverte jusqu'au <b>${fmtJour(fin)}</b> et ne peut pas être changée. Vérifie la preuve puis clique sur <b>Valider</b>. Les mots de passe ne sont jamais visibles.</p>
        <div class="card table-wrap"><table class="tbl">
          <thead><tr><th>Nom</th><th>Email</th><th>Dernière connexion</th><th>Accès aux cours</th><th>Rôle</th><th>Compte</th></tr></thead>
          <tbody>${members.map((m) => {
            const ai = info(m); const self = m.id === u.id || m.role === "admin";
            let acc;
            if (m.role === "admin" || m.role === "editor") acc = `<span class="badge b-Cours">Toutes les années · inclus</span>`;
            else if (ai.univ) acc = ai.choix
              ? `<span class="badge b-Cours">Gratuit FMPC · ${esc(anneeCourt(ai.choix.filiere, ai.choix.annee))}</span><div class="small muted" style="margin-top:4px">année choisie, modifiable</div>`
              : `<span class="badge">Gratuit FMPC · année pas encore choisie</span>`;
            else {
              const chips = ai.annees.map((x) => `<span class="acc-chip">${esc(anneeCourt(x.filiere, x.annee))} <small>→ ${esc(fmtJour(x.jusqu))}</small><button class="acc-x" title="Retirer l'accès" data-retirer="${esc(m.id)}|${x.filiere}|${x.annee}">×</button></span>`).join("");
              const dems = (m.demandes_list || []).map((d) => `<div class="acc-dem">
                  <span class="badge b-Examen">À vérifier · ${esc(anneeCourt(d.filiere, d.annee))} · ${esc(modeLabel(d.mode))}</span>
                  <div class="row-actions">
                    ${d.preuve ? `<button class="btn btn-sm btn-ghost" data-preuve="${esc(d.preuve)}">${I.eye} Preuve</button>` : ""}
                    <button class="btn btn-sm" data-valider="${d.id}">Valider</button>
                    <button class="btn btn-sm btn-danger" data-refuser="${d.id}">Refuser</button>
                  </div></div>`).join("");
              acc = `${dems}<div class="acc-chips">${chips || '<span class="badge">Aucune année</span>'}</div>
                <div class="acc-give"><select class="input" data-give-sel="${esc(m.id)}"><option value="">+ Donner une année…</option>${optsAnnees}</select></div>`;
            }
            return `<tr${m.actif === false ? ' style="opacity:.5"' : ""}>
              <td><b>${esc(m.nom || "—")}</b><div class="small muted">inscrit ${fmtDate(m.created_at)}</div></td>
              <td class="small">${esc(m.email)}</td>
              <td class="muted small">${m.last_seen ? timeAgo(m.last_seen) : "jamais"}</td>
              <td class="acc-cell">${acc}</td>
              <td>${self ? `<span class="badge b-pin">${roleLabel(m.role)}</span>` : `
                <select class="input" data-role="${esc(m.id)}">
                  <option value="user" ${m.role === "user" ? "selected" : ""}>Étudiant</option>
                  <option value="editor" ${m.role === "editor" ? "selected" : ""}>Éditeur</option>
                </select>`}</td>
              <td>${self ? "—" : `<button class="btn btn-sm ${m.actif === false ? "btn-soft" : "btn-ghost"}" data-actif="${esc(m.id)}" data-val="${m.actif === false ? "1" : "0"}">${m.actif === false ? "Réactiver" : "Suspendre"}</button>`}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`;
      const act = (sel, fn, ok) => $$(sel, box).forEach((el) => (el.onclick = async () => {
        try { if ((await fn(el)) === false) return; toast(ok); route(); } catch (e) { toast(e.message, true); }
      }));
      $$("[data-role]", box).forEach((sel) => (sel.onchange = async () => {
        try { await Store.setRole(sel.dataset.role, sel.value); toast("Rôle mis à jour ✓"); }
        catch (e) { toast(e.message, true); }
      }));
      act("[data-actif]", (b) => Store.setActif(b.dataset.actif, b.dataset.val === "1"), "Compte mis à jour ✓");
      act("[data-valider]", async (b) => {
        if (!(await confirmBox(`Valider le paiement et débloquer l'année jusqu'au ${fmtJour(fin)} ?`, "Valider"))) return false;
        await Store.validerDemande(Number(b.dataset.valider));
      }, "Année débloquée ✓");
      act("[data-refuser]", async (b) => {
        if (!(await confirmBox("Refuser cette demande de paiement ?", "Refuser"))) return false;
        await Store.refuserDemande(Number(b.dataset.refuser));
      }, "Demande refusée");
      act("[data-retirer]", async (b) => {
        const [uid, f, a] = b.dataset.retirer.split("|");
        if (!(await confirmBox(`Retirer l'accès à ${anneeNom(f, a)} ?`, "Retirer"))) return false;
        await Store.retirerAcces(uid, f, a);
      }, "Accès retiré");
      $$("[data-give-sel]", box).forEach((sel) => (sel.onchange = async () => {
        if (!sel.value) return;
        const [f, a] = sel.value.split(":");
        if (!(await confirmBox(`Donner l'accès à ${anneeNom(f, a)} jusqu'au ${fmtJour(fin)} ?`, "Donner l'accès"))) { sel.value = ""; return; }
        try { await Store.donnerAcces(sel.dataset.giveSel, f, a); toast("Accès donné ✓"); route(); } catch (e) { toast(e.message, true); }
      }));
      $$("[data-preuve]", box).forEach((b) => (b.onclick = async () => {
        try {
          const url = await Store.preuveUrl(b.dataset.preuve);
          const isPdf = /\.pdf$/i.test(b.dataset.preuve);
          previewFile({ title: "Preuve de paiement", url, type: isPdf ? "pdf" : "image", open: url });
        } catch (e) { toast(e.message, true); }
      }));
      return;
    }

    if (tab === "drive" && isAdmin()) {
      box.innerHTML = `
        <p class="small muted">Les semestres se relient dans <code>js/config.js</code> (champ <code>drive</code> de chaque semestre).</p>
        <div class="grid grid-2">${CFG.filieres.map((f) => `<div class="card card-pad"><h3>${esc(f.nom)}</h3><div class="status-list">
          ${f.annees.flatMap((a) => a.semestres.map((x) => `<div><span>${esc(a.label)} · ${x.code}</span>${x.drive ? `<a class="ok" href="${Drive.folderUrl(x.drive)}" target="_blank" rel="noopener">lié ✓</a>` : `<span class="ko">non lié</span>`}</div>`)).join("")}
        </div></div>`).join("")}</div>
        <div class="card card-pad" style="margin-top:16px">
          <h3>Mettre à jour la liste des cours</h3>
          <p class="small muted">La liste des cours est protégée dans ta base : seuls les comptes qui ont accès la voient. Quand Claude te donne un nouveau fichier <code>drive-import.json</code>, importe-le ici. ${Drive.snapshotDate() ? `Dernière mise à jour : <b>${esc(Drive.snapshotDate())}</b>.` : "Aucune liste importée pour l'instant."}</p>
          <label class="btn btn-soft" style="width:max-content">${I.dl} Importer drive-import.json<input type="file" id="drive-import" accept=".json,application/json" hidden></label>
        </div>
        ${Store.demo ? `<p style="margin-top:16px"><button class="btn btn-ghost btn-sm" data-action="reset-demo">Réinitialiser les données de démo</button></p>` : ""}`;
      $("#drive-import").onchange = async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const json = JSON.parse(await f.text());
          if (!json.semestres || !json.stats) throw new Error("Ce fichier n'est pas un drive-import.json valide.");
          await Store.importSnapshot(json);
          toast(`Liste importée ✓ (${json.stats.files} fichiers)`); route();
        } catch (err) { toast(err.message, true); }
      };
      return;
    }

    const [news, plans, les] = await Promise.all(["news", "plannings", "lessons"].map((t) => Store.list(t).then((r) => remember(t, r))));
    const rows = [
      ...news.map((r) => ({ t: "news", type: "Actualité", titre: r.titre, ctx: r.categorie, r })),
      ...plans.map((r) => ({ t: "plannings", type: "Planning", titre: r.titre, ctx: `${filiere(r.filiere)?.nom || r.filiere} · ${anneeLabel(r.filiere, r.annee)}`, r })),
      ...les.map((r) => ({ t: "lessons", type: "Leçon", titre: r.titre, ctx: `${filiere(r.filiere)?.nom || r.filiere} · ${anneeLabel(r.filiere, r.annee)} · ${r.module}`, r })),
    ].sort((x, y) => y.r.created_at.localeCompare(x.r.created_at));
    box.innerHTML = rows.length ? `<div class="card table-wrap"><table class="tbl">
      <thead><tr><th>Type</th><th>Titre</th><th>Où</th><th>Par</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows.map((x) => `<tr>
        <td><span class="badge">${x.type}</span></td><td><b>${esc(x.titre)}</b></td><td class="muted small">${esc(x.ctx)}</td>
        <td class="small">${esc(x.r.auteur_nom || "—")}</td><td class="small muted">${timeAgo(x.r.created_at)}</td>
        <td><div class="row-actions" style="justify-content:flex-end">
          ${x.t === "news" ? `<button class="btn btn-sm btn-ghost" data-edit-news="${x.r.id}" title="Modifier">${I.edit}</button>` : ""}
          <button class="btn btn-sm btn-danger" data-del="${x.t}:${x.r.id}" title="Supprimer">${I.trash}</button></div></td>
      </tr>`).join("")}</tbody></table></div>`
      : emptyState("Rien de publié", "Utilise les boutons ci-dessus pour commencer.");
  }

  /* ---------------- Lecteur de document + notes personnelles ---------------- */
  // Retrouve filière / année / semestre à partir du dossier racine du semestre
  function semFromRoot(root) {
    for (const f of CFG.filieres) for (const a of f.annees) for (const x of a.semestres) if (x.drive && x.drive === root) return { f, a, s: x };
    return null;
  }

  async function pageFichier(id) {
    const info = id && Drive.info(id);
    if (!info || info.folder) {
      main.innerHTML = emptyState("Document indisponible", "Ce document ne fait pas partie de ton année, ou il a été déplacé.<br><br><a class=\"btn btn-soft\" href=\"#/notes\">Voir mes notes</a>", I.file);
      return;
    }
    const tr = Drive.trail(id);
    const loc = semFromRoot(tr.root);
    const back = loc ? `#/lecons/${loc.f.id}/${loc.a.annee}/${loc.s.code}${tr.folders.length ? "/" + tr.folders.join("/") : ""}` : "#/lecons";
    const folderNames = tr.folders.map((x) => prettyName((Drive.info(x) || {}).name || ""));
    const contexte = [loc ? `${anneeCourt(loc.f.id, loc.a.annee)} · ${loc.s.code}` : "", ...folderNames].filter(Boolean).join(" › ");
    const items = await Drive.list(info.parent);
    const it = items.find((x) => x.id === id) || { id, name: info.name, mimeType: "" };
    const isNative = (it.mimeType || "").startsWith("application/vnd.google-apps");
    const kind = fileKind(it.mimeType, it.name)[0];
    // Stylo / surligneur : PDF et images, si une clé Google « fichiers » est configurée
    const fkey = CFG.googleFichiersKey;
    const canAnnot = !!(window.Annot && (kind === "pdf" || kind === "img") && (Store.fetchFichier || fkey));
    const iframeHtml = `<div class="spinner"></div><iframe src="${esc(Drive.previewUrl(id))}" title="Aperçu du document" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>`;
    document.title = `${info.name} — ${CFG.nomSite}`;
    main.innerHTML = `<div class="viewer" id="viewer">
      <div class="viewer-head">
        <a class="icon-btn" href="${back}" title="Retour au dossier" aria-label="Retour au dossier">${I.back}</a>
        <div class="viewer-title"><b data-i18n-skip>${esc(info.name)}</b><small class="muted" data-i18n-skip>${esc(contexte)}</small></div>
        <div class="viewer-acts">
          ${isNative ? "" : `<a class="btn btn-sm btn-ghost" href="${esc(Drive.downloadUrl(it))}" target="_blank" rel="noopener" title="Télécharger">${I.dl}<span>Télécharger</span></a>`}
          <button class="btn btn-sm btn-ghost" id="vw-full" aria-pressed="false" title="Plein écran">${I.expand}<span>Plein écran</span></button>
          <button class="btn btn-sm btn-soft" id="vw-toggle" aria-expanded="true">${I.edit}<span>Notes & IA</span></button>
        </div>
      </div>
      <div class="viewer-body">
        <div class="viewer-doc">${canAnnot ? `<div class="annot" id="annot"></div>` : iframeHtml}</div>
        <aside class="viewer-notes" id="vw-notes">
          <div class="vn-tabs" role="tablist">
            <button type="button" role="tab" data-vtab="notes" class="on" aria-selected="true">${I.edit}<span>Mes notes</span></button>
            <button type="button" role="tab" data-vtab="ia" aria-selected="false">${I.spark}<span>Assistant IA</span></button>
          </div>
          <div class="vn-pane" data-pane="notes">
            <div class="vn-head"><span class="small muted" id="vn-status"></span></div>
            <textarea id="vn-text" class="input" dir="auto" maxlength="20000" disabled placeholder="${esc(T("Écris tes notes ici… Elles sont enregistrées automatiquement."))}"></textarea>
            <div class="vn-foot small muted">${I.lock}<span>Privées : toi seul peux les voir.</span></div>
          </div>
          <div class="vn-pane" data-pane="ia" hidden></div>
        </aside>
      </div>
    </div>`;

    const viewer = $("#viewer"), ta = $("#vn-text"), status = $("#vn-status");
    const wireFrame = () => { const fr = $(".viewer-doc iframe", viewer); if (fr) fr.addEventListener("load", () => { const sp = $(".viewer-doc .spinner", viewer); if (sp) sp.remove(); }); };
    wireFrame();
    let annot = null;
    if (canAnnot) {
      let adata = null;
      try { const a = await Store.getAnnot(id); adata = a && a.data; } catch (e) { toast(e.message, true); }
      annot = await window.Annot.mount($("#annot"), {
        load: Store.fetchFichier
          ? () => Store.fetchFichier(id)
          : () => fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(fkey)}`),
        kind, data: adata, t: T,
        onSave: (d) => Store.saveAnnot(id, d, { nom: info.name, contexte }),
        onError: (e) => toast(e.message, true),
        // si le fichier ne peut pas être chargé ici, on revient à l'aperçu Google
        onFail: () => { const box = $(".viewer-doc", viewer); if (box) { box.innerHTML = iframeHtml; wireFrame(); } },
      });
    }
    $("#vw-toggle").onclick = () => {
      const hidden = viewer.classList.toggle("no-notes");
      $("#vw-toggle").setAttribute("aria-expanded", String(!hidden));
      if (!hidden && window.innerWidth < 900) $("#vw-notes").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    let saved = "", timer = null, saving = Promise.resolve();
    const setStatus = (t) => { status.textContent = t ? T(t) : ""; };
    const save = () => {
      clearTimeout(timer); timer = null;
      const val = ta.value;
      if (val === saved) return saving;
      setStatus("Enregistrement…");
      saving = saving.then(() => Store.saveNote(id, { contenu: val, nom: info.name, contexte }))
        .then(() => { saved = val; if (document.body.contains(status)) setStatus(val.trim() ? "Enregistré ✓" : ""); })
        .catch((e) => { if (document.body.contains(status)) setStatus(""); toast(e.message, true); });
      return saving;
    };
    try {
      const n = await Store.getNote(id);
      saved = (n && n.contenu) || ""; ta.value = saved;
      if (n && n.updated_at) status.textContent = T("Modifiée") + " " + timeAgo(n.updated_at);
    } catch (e) { toast(e.message, true); }
    ta.disabled = false;
    ta.addEventListener("input", () => { setStatus("Modifications non enregistrées"); clearTimeout(timer); timer = setTimeout(save, 900); });
    ta.addEventListener("blur", save);
    // Plein écran : le document (avec le stylo), les notes et l'assistant restent utilisables
    const fsBtn = $("#vw-full");
    const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
    const setFull = (on) => {
      viewer.classList.toggle("vfull", on);
      document.body.classList.toggle("no-scroll", on);
      fsBtn.innerHTML = `${on ? I.shrink : I.expand}<span>${esc(T(on ? "Quitter le plein écran" : "Plein écran"))}</span>`;
      fsBtn.title = T(on ? "Quitter le plein écran" : "Plein écran");
      fsBtn.setAttribute("aria-pressed", String(on));
      setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    };
    const quitterFull = async () => {
      if (viewer.classList.contains("vfull")) setFull(false);
      try { if (fsEl()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()); } catch (e) {}
    };
    fsBtn.onclick = async () => {
      if (viewer.classList.contains("vfull")) return quitterFull();
      setFull(true);
      try { if (viewer.requestFullscreen) await viewer.requestFullscreen(); else if (viewer.webkitRequestFullscreen) viewer.webkitRequestFullscreen(); } catch (e) { /* plein écran « dans la page » seulement */ }
    };
    const surChangement = () => { if (!fsEl() && viewer.classList.contains("vfull") && document.body.contains(viewer)) setFull(false); };
    document.addEventListener("fullscreenchange", surChangement);
    document.addEventListener("webkitfullscreenchange", surChangement);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.contains(viewer) && viewer.classList.contains("vfull")) quitterFull(); });

    route.flush = () => Promise.all([save(), annot ? annot.flush() : null, quitterFull()]);

    // Onglets du panneau + assistant IA (lit le PDF / l'image ouverts)
    let chatMonte = false;
    $$("[data-vtab]", viewer).forEach((b) => (b.onclick = () => {
      $$("[data-vtab]", viewer).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", String(x === b)); });
      $$(".vn-pane", viewer).forEach((pn) => (pn.hidden = pn.dataset.pane !== b.dataset.vtab));
      if (b.dataset.vtab === "ia" && !chatMonte) {
        chatMonte = true;
        const lisible = kind === "pdf" || kind === "img";
        mountChat($(".vn-pane[data-pane=ia]", viewer), {
          cle: "fichier:" + id,
          fichier: lisible ? id : "",
          intro: lisible
            ? `${T("Je lis ce document avec toi.")} ${T("Demande-moi de le résumer, d'expliquer une notion ou de te faire des QCM.")}`
            : T("Je ne peux pas lire ce type de fichier (PowerPoint, Word…), mais tu peux me poser tes questions librement."),
          rapides: lisible ? ["Résume ce cours", "Explique simplement les notions difficiles", "Fais-moi 5 QCM sur ce cours", "Les points clés à retenir pour l'examen"] : [],
          ajouterNote: (txt) => {
            ta.value = (ta.value.trim() ? ta.value.trimEnd() + "\n\n" : "") + "— " + T("Assistant IA") + " —\n" + txt;
            ta.dispatchEvent(new Event("input"));
            toast(T("Ajouté à tes notes ✓"));
          },
        });
      }
    }));
    window.addEventListener("beforeunload", () => { if (ta.value !== saved) save(); if (annot) annot.flush(); }, { once: true });
  }

  /* ---------------- Assistant IA (Gemini) ---------------- */
  const conversations = new Map(); // garde la discussion pendant la session
  // Mini-Markdown sûr (le texte est échappé avant la mise en forme)
  function md(src) {
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(src).split("\n")) {
      const l = raw.trimEnd();
      let m;
      if ((m = l.match(/^\s*#{1,6}\s+(.*)$/))) { close(); out.push(`<h4>${inline(m[1])}</h4>`); }
      else if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if (!l.trim()) close();
      else { close(); out.push(`<p>${inline(l)}</p>`); }
    }
    close();
    return out.join("");
  }

  function mountChat(box, { cle, fichier = "", intro, rapides = [], ajouterNote = null }) {
    const hist = conversations.get(cle) || [];
    conversations.set(cle, hist);
    box.innerHTML = `<div class="chat">
      <div class="chat-msgs" aria-live="polite"></div>
      <div class="chat-quick"></div>
      <form class="chat-form">
        <textarea class="input" rows="2" dir="auto" maxlength="4000" placeholder="${esc(T("Pose ta question…"))}"></textarea>
        <button class="btn" type="submit" title="${esc(T("Envoyer"))}" aria-label="${esc(T("Envoyer"))}">${I.send}</button>
      </form>
      <div class="chat-foot small muted"><span class="chat-left"></span><span>${esc(T("Gemini peut se tromper : vérifie avec ton cours."))}</span></div>
    </div>`;
    const msgs = $(".chat-msgs", box), form = $(".chat-form", box), input = $("textarea", form), left = $(".chat-left", box), quick = $(".chat-quick", box);
    let busy = false;
    const setLeft = (n) => { if (typeof n === "number") left.textContent = `${n} ${T(n > 1 ? "questions restantes aujourd'hui" : "question restante aujourd'hui")} · `; };
    if (Store.iaRestant) Store.iaRestant().then(setLeft).catch(() => {});

    function bulle(m) {
      const el = document.createElement("div");
      el.className = "msg " + (m.role === "user" ? "msg-user" : m.role === "error" ? "msg-err" : "msg-ai");
      if (m.role === "model") {
        el.innerHTML = `<div class="msg-body" dir="auto" data-i18n-skip>${md(m.text)}</div>
          <div class="msg-acts"><button type="button" class="link-btn" data-copy>${esc(T("Copier"))}</button>${ajouterNote ? `<button type="button" class="link-btn" data-note>${esc(T("Ajouter à mes notes"))}</button>` : ""}</div>`;
        $("[data-copy]", el).onclick = async () => { try { await navigator.clipboard.writeText(m.text); toast(T("Copié ✓")); } catch (e) { toast(T("Copie impossible"), true); } };
        const nb = $("[data-note]", el); if (nb) nb.onclick = () => ajouterNote(m.text);
      } else {
        el.innerHTML = `<div class="msg-body" dir="auto" ${m.role === "user" ? "data-i18n-skip" : ""}>${esc(m.text)}</div>`;
      }
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
      return el;
    }
    bulle({ role: "intro", text: intro });
    hist.forEach(bulle);
    quick.innerHTML = rapides.map((q) => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join("");
    quick.hidden = !rapides.length || hist.length > 0;

    async function envoyer(texte) {
      texte = texte.trim();
      if (!texte || busy) return;
      if (!Store.askIA) { toast(T("L'assistant n'est pas disponible ici."), true); return; }
      busy = true; quick.hidden = true; input.value = "";
      const m = { role: "user", text: texte };
      hist.push(m); bulle(m);
      const wait = bulle({ role: "intro", text: T("L'assistant réfléchit…") }); wait.classList.add("msg-wait");
      try {
        const r = await Store.askIA(hist.map((x) => ({ role: x.role, text: x.text })), fichier);
        wait.remove();
        const rep = { role: "model", text: r.texte };
        hist.push(rep); bulle(rep); setLeft(r.restant);
      } catch (e) {
        wait.remove();
        hist.pop(); // la question n'a pas eu de réponse : on la retire de l'historique
        bulle({ role: "error", text: e.message || T("L'assistant n'a pas pu répondre. Réessaie.") });
        if (typeof e.restant === "number") setLeft(e.restant);
        input.value = texte;
      } finally { busy = false; input.focus(); }
    }
    form.onsubmit = (e) => { e.preventDefault(); envoyer(input.value); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(input.value); } });
    quick.onclick = (e) => { const b = e.target.closest("[data-q]"); if (b) envoyer(T(b.dataset.q)); };
  }

  function pageAssistant() {
    main.innerHTML = `
      <div class="page-head"><div><h1>Assistant IA</h1><p>Pose tes questions de cours à Gemini. Pour qu'il lise un cours, ouvre un PDF dans Leçons puis choisis l'onglet « Assistant IA ».</p></div></div>
      <section class="card assistant-card" id="ia-box"></section>`;
    mountChat($("#ia-box"), {
      cle: "general",
      intro: T("Bonjour ! Je suis ton assistant de révision. Pose-moi une question de cours, demande une explication ou un QCM."),
      rapides: ["Explique-moi le cycle cardiaque simplement", "Fais-moi 5 QCM d'anatomie du cœur", "Quelle différence entre artère et veine ?", "Comment bien réviser un module en 1 semaine ?"],
    });
  }

  async function pageNotes() {
    const [txt, ann] = await Promise.all([Store.listNotes(), Store.listAnnots().catch(() => [])]);
    const byId = new Map();
    txt.forEach((n) => byId.set(n.fichier, { ...n }));
    ann.forEach((a) => {
      const n = byId.get(a.fichier);
      if (n) { n.annote = true; if (a.updated_at > n.updated_at) n.updated_at = a.updated_at; }
      else byId.set(a.fichier, { fichier: a.fichier, nom: a.nom, contexte: a.contexte, contenu: "", updated_at: a.updated_at, annote: true });
    });
    const notes = [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    main.innerHTML = `
      <div class="page-head"><div><h1>Mes notes</h1><p>Toutes les notes que tu as prises sur les cours. Elles sont privées.</p></div></div>
      ${notes.length ? `<div class="notes-list">${notes.map((n) => `
        <article class="card note-card">
          <a class="note-main" href="#/fichier/${esc(n.fichier)}">
            <span class="fi fi-doc">${I.edit}</span>
            <span class="note-txt"><b data-i18n-skip>${esc(n.nom || "Document")}</b>
              ${n.contexte ? `<small class="muted" data-i18n-skip>${esc(n.contexte)}</small>` : ""}
              ${n.annote ? `<span class="badge note-ink">${I.edit} ${esc(T("Annoté au stylo"))}</span>` : ""}
              ${n.contenu ? `<span class="note-snip" dir="auto" data-i18n-skip>${esc(n.contenu.slice(0, 220))}${n.contenu.length > 220 ? "…" : ""}</span>` : ""}
              <small class="muted">${esc(T("Modifiée"))} ${timeAgo(n.updated_at)}</small></span>
          </a>
          <button class="icon-btn" data-del-note="${esc(n.fichier)}" title="Supprimer la note" aria-label="Supprimer la note" style="color:var(--danger)">${I.trash}</button>
        </article>`).join("")}</div>`
        : emptyState("Aucune note pour l'instant", "Ouvre un fichier dans Leçons et écris dans « Mes notes » : tout est enregistré ici automatiquement.<br><br><a class=\"btn\" href=\"#/lecons\">Voir les leçons</a>", I.edit)}`;
    $$("[data-del-note]").forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox("Supprimer cette note et les annotations au stylo de ce fichier ? Cette action est définitive."))) return;
      try { await Promise.all([Store.deleteNote(b.dataset.delNote), Store.deleteAnnot(b.dataset.delNote)]); toast("Note supprimée"); route(); } catch (e) { toast(e.message, true); }
    }));
  }

  function notFound() {
    main.innerHTML = emptyState("Page introuvable", `<a href="#/">Retour à l'accueil</a>`);
  }

  /* ------------------------------ routeur ----------------------------- */
  /* ---------------- Accueil public + inscription (connexion obligatoire) --------------- */
  function siteStats() {
    // Calculé depuis la copie du Drive (aperçu) ; sur le vrai site : ligne publique « stats »
    const PR = /calendrier|diffusion|exam|planning|emploi du temps|annonce|\bSN\b/i;
    let files = 0, modules = 0; const semestres = [];
    CFG.filieres.forEach((f) => f.annees.forEach((a) => a.semestres.forEach((x) => {
      if (!x.drive || !Drive.rootItems(x.drive).length) return;
      const n = Drive.countFiles(x.drive) || 0; files += n;
      const ms = Drive.rootItems(x.drive).filter((it) => it[2] && !PR.test(it[1])).map((it) => ({ nom: it[1], fichiers: Drive.countFiles(it[0]) || 0 }));
      modules += ms.length;
      semestres.push({ filiere: f.id, annee: a.annee, code: x.code, fichiers: n, modules: ms });
    })));
    return { files, modules, semestres };
  }
  const ECG_PATH = "M0 60 H220 L250 60 L262 48 L274 60 H300 L318 60 L330 14 L344 106 L358 36 L370 60 H560 L590 60 L602 50 L614 60 H640 L658 60 L670 14 L684 106 L698 36 L710 60 H900 L930 60 L942 48 L954 60 H980 L998 60 L1010 14 L1024 106 L1038 36 L1050 60 H1200";

  // QCM du jour (connaissances de base, vérifiées)
  const QCM = [
    { q: "Combien de paires de nerfs crâniens possède l'être humain ?", r: ["10", "12", "31", "8"], ok: 1,
      e: "12 paires, du nerf olfactif (I) au nerf hypoglosse (XII). Les 31 paires correspondent aux nerfs spinaux." },
    { q: "Quel ion entre dans le neurone pendant la dépolarisation du potentiel d'action ?", r: ["K⁺", "Na⁺", "Cl⁻", "HCO₃⁻"], ok: 1,
      e: "L'ouverture des canaux sodiques voltage-dépendants fait entrer le Na⁺ ; la repolarisation est due à la sortie de K⁺." },
    { q: "À quelle partie du cerveau appartient le thalamus ?", r: ["Tronc cérébral", "Cervelet", "Diencéphale", "Télencéphale"], ok: 2,
      e: "Le thalamus fait partie du diencéphale, avec l'hypothalamus et l'épithalamus." },
    { q: "Quelle hormone fait baisser la glycémie ?", r: ["Glucagon", "Cortisol", "Insuline", "Adrénaline"], ok: 2,
      e: "L'insuline, sécrétée par les cellules β des îlots de Langerhans, est la seule hormone hypoglycémiante." },
    { q: "Quelle valve sépare l'oreillette gauche du ventricule gauche ?", r: ["Tricuspide", "Mitrale", "Aortique", "Pulmonaire"], ok: 1,
      e: "La valve mitrale (bicuspide) est à gauche ; la tricuspide sépare les cavités droites." },
    { q: "Quelle cellule produit les anticorps ?", r: ["Lymphocyte T CD8", "Plasmocyte", "Macrophage", "Polynucléaire neutrophile"], ok: 1,
      e: "Les plasmocytes sont des lymphocytes B différenciés qui sécrètent les immunoglobulines." },
    { q: "Où le glucose filtré est-il principalement réabsorbé dans le rein ?", r: ["Tube contourné proximal", "Anse de Henle", "Tube contourné distal", "Tube collecteur"], ok: 0,
      e: "Le tube contourné proximal réabsorbe la quasi-totalité du glucose filtré (cotransport Na⁺-glucose)." },
  ];

  function landingPage() {
    const st = siteStats();
    const fmt = (n) => n >= 100 ? (Math.floor(n / 100) * 100).toLocaleString(LOC()) + "+" : String(n);
    const dom = CFG.domaineGratuit || "etu.univh2c.ma";
    const fin = fmtJour(window.finAnneeUniv());
    main.innerHTML = `
      <section class="land-hero">
        <div class="land-grid" aria-hidden="true"></div>
        <svg class="ecg" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path class="ecg-base" d="${ECG_PATH}"/><path class="ecg-pulse" d="${ECG_PATH}"/></svg>
        <div class="land-content">
          <span class="land-badge"><i></i> ${esc(CFG.faculte)}</span>
          <h1>Tes cours de médecine,<br><em>organisés semestre par semestre.</em></h1>
          <p>Cours, résumés, QCM, plannings et annonces de la promo, réunis sur une seule plateforme réservée aux étudiants.</p>
          <div class="land-cta">
            <a class="btn btn-lg btn-light" href="#/commencer">Commencer <span aria-hidden="true" class="arr">→</span></a>
            <a class="btn btn-lg btn-outline-light" href="#/connexion">J'ai déjà un compte</a>
          </div>
          <dl class="land-stats" id="land-stats" ${st.files ? "" : "hidden"}>
            <div><dt data-k="files">${fmt(st.files)}</dt><dd>fichiers de cours</dd></div>
            <div><dt data-k="modules">${st.modules}</dt><dd>modules</dd></div>
          </dl>
        </div>
      </section>

      <section class="section">
        <div class="land-features">
          <div class="feat"><span class="ico" style="background:var(--primary-50);color:var(--primary)">${I.book}</span><b>Cours par semestre</b><p>Anatomie, physiologie, sémiologie… classés comme le Drive de la promo.</p></div>
          <div class="feat"><span class="ico" style="background:var(--info-50);color:var(--info)">${I.search}</span><b>Recherche instantanée</b><p>Tape « thalamus » ou « ECG » et retrouve le bon fichier en une seconde.</p></div>
          <div class="feat"><span class="ico" style="background:var(--warn-50);color:var(--warn)">${I.cal}</span><b>Plannings à jour</b><p>Emplois du temps, examens et TP publiés par les délégués.</p></div>
          <div class="feat"><span class="ico" style="background:var(--accent-50);color:var(--accent)">${I.news}</span><b>Actualités de la fac</b><p>Annonces importantes épinglées, pour ne rien rater.</p></div>
        </div>
      </section>

      <section class="section land-explore" id="land-explore" hidden>
        <div class="section-head"><div><h2>Explore les cours disponibles</h2><p class="muted small" style="margin:4px 0 0">Choisis un semestre pour voir ses modules et le nombre de fichiers.</p></div></div>
        <div class="card card-pad">
          <div class="chips" id="lx-tabs" role="tablist"></div>
          <ul class="lx-list" id="lx-list"></ul>
          <p class="small muted lx-note">${I.lock} Les fichiers s'ouvrent après connexion.</p>
        </div>
      </section>

      <section class="section land-two">
        <div class="card card-pad qcm" id="qcm">
          <div class="qcm-head"><span class="badge" style="background:var(--accent-50);color:var(--accent)">QCM du jour</span><span class="small muted" id="qcm-n"></span></div>
          <h3 id="qcm-q"></h3>
          <div class="qcm-opts" id="qcm-opts"></div>
          <p class="qcm-exp" id="qcm-exp" hidden></p>
          <button class="btn btn-ghost btn-sm" id="qcm-next">Autre question <span aria-hidden="true" class="arr">→</span></button>
        </div>
        <div class="card card-pad price">
          <span class="badge" style="background:var(--primary-50);color:var(--primary)">Tarifs</span>
          <h3>Simple et transparent</h3>
          <div class="price-row free"><div><b>Étudiant FMPC</b><small>email @${esc(dom)} · 1 année au choix, modifiable</small></div><span class="price-tag">Gratuit</span></div>
          <div class="price-row"><div><b>Autre email</b><small>par année d'études, jusqu'au ${esc(fin)} · non modifiable</small></div><span class="price-tag">${esc(prixTexte())}</span></div>
          <ul class="price-list">
            <li>${I.check} Tous les modules de l'année choisie (2 semestres)</li>
            <li>${I.check} Recherche dans tous les fichiers</li>
            <li>${I.check} Plannings et actualités</li>
          </ul>
          <a class="btn" href="#/commencer">Commencer <span aria-hidden="true" class="arr">→</span></a>
        </div>
      </section>

      <section class="section land-faq">
        <h2>Questions fréquentes</h2>
        <div class="faq">
          <details><summary>Est-ce que c'est gratuit ?</summary><p>Oui, pour les étudiants de la FMPC qui créent leur compte avec leur email @${esc(dom)} : ils choisissent leur année gratuitement et peuvent la changer quand ils veulent. Avec un autre email, chaque année d'études coûte ${esc(prixTexte())}, et l'année payée ne peut pas être changée.</p></details>
          <details><summary>Je peux changer d'année ?</summary><p>Avec un email @${esc(dom)}, oui, à tout moment depuis « Mon année ». Une année payée reste fixe : pour une autre année, il faut la débloquer aussi.</p></details>
          <details><summary>Combien de temps dure l'accès payé ?</summary><p>Jusqu'au 30 septembre, c'est-à-dire jusqu'à la fin de l'année universitaire.</p></details>
          <details><summary>Comment payer ?</summary><p>Par carte bancaire (paiement sécurisé YouCan Pay) ou par virement / CashPlus, en envoyant la photo du reçu.</p></details>
          <details><summary>D'où viennent les cours ?</summary><p>Du Drive partagé par la promo : cours, résumés, QCM et schémas, classés par semestre et par module.</p></details>
          <details><summary>J'ai oublié mon mot de passe.</summary><p>Sur la page de connexion, clique sur « Mot de passe oublié ? » : tu recevras un lien par email pour en choisir un nouveau.</p></details>
        </div>
      </section>

      <section class="section land-steps-wrap">
        <h2>Trois étapes pour commencer</h2>
        <ol class="land-steps">
          <li><b>Crée ton compte</b><span>Prénom, nom, email et mot de passe.</span></li>
          <li><b>Confirme ton email</b><span>Clique sur le lien reçu dans ta boîte mail.</span></li>
          <li><b>Choisis ton année</b><span>Gratuit avec ton email @${esc(dom)}.</span></li>
        </ol>
        <a class="btn btn-lg" href="#/commencer">Commencer <span aria-hidden="true" class="arr">→</span></a>
      </section>`;

    // --- Explorateur de modules
    function explorer(stats) {
      const sems = (stats && stats.semestres) || [];
      const sec = $("#land-explore"); if (!sec || !sems.length) return;
      sec.hidden = false;
      let i = sems.length - 1;
      const draw = () => {
        $("#lx-tabs").innerHTML = sems.map((x, k) => `<button class="chip ${k === i ? "active" : ""}" role="tab" data-k="${k}">${esc(anneeCourt(x.filiere, x.annee))} · ${x.code}</button>`).join("");
        const ms = sems[i].modules.slice().sort((a, b) => b.fichiers - a.fichiers);
        const max = Math.max(1, ...ms.map((m) => m.fichiers));
        $("#lx-list").innerHTML = ms.map((m) => `<li><span class="lx-name">${esc(m.nom.charAt(0).toUpperCase() + m.nom.slice(1))}</span>
          <span class="lx-bar"><i style="width:${Math.max(2, Math.round((m.fichiers / max) * 100))}%"></i></span>
          <span class="lx-n">${m.fichiers}</span></li>`).join("");
        $$("#lx-tabs .chip").forEach((b) => (b.onclick = () => { i = Number(b.dataset.k); draw(); }));
      };
      draw();
    }
    explorer(st);

    // --- QCM du jour
    let qi = Math.floor(Date.now() / 864e5) % QCM.length;
    const drawQ = () => {
      const q = QCM[qi];
      $("#qcm-n").textContent = `${qi + 1} / ${QCM.length}`;
      $("#qcm-q").textContent = q.q;
      $("#qcm-exp").hidden = true;
      $("#qcm-opts").innerHTML = q.r.map((r, k) => `<button class="qcm-opt" data-k="${k}"><span class="qcm-l">${"ABCD"[k]}</span><span>${esc(r)}</span></button>`).join("");
      $$("#qcm-opts .qcm-opt").forEach((b) => (b.onclick = () => {
        const k = Number(b.dataset.k);
        $$("#qcm-opts .qcm-opt").forEach((x) => {
          x.disabled = true;
          if (Number(x.dataset.k) === q.ok) x.classList.add("good");
        });
        if (k !== q.ok) b.classList.add("bad");
        const ex = $("#qcm-exp");
        ex.innerHTML = `<b>${k === q.ok ? "Bonne réponse !" : "Pas tout à fait."}</b> ${esc(q.e)}`;
        ex.hidden = false;
      }));
    };
    drawQ();
    $("#qcm-next").onclick = () => { qi = (qi + 1) % QCM.length; drawQ(); };

    // --- Chiffres publics (vrai site)
    if (Store.publicStats) Store.publicStats().then((ps) => {
      const box = $("#land-stats"); if (!ps || !box) return;
      $('[data-k="files"]', box).textContent = fmt(ps.files || 0);
      $('[data-k="modules"]', box).textContent = ps.modules || 0;
      box.hidden = false;
      if (!st.semestres.length) explorer(ps);
    }).catch(() => {});
  }

  function authPage(mode) {
    main.innerHTML = `
      <div class="auth-page">
        <aside class="auth-side">
          <svg class="ecg ecg-side" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path class="ecg-base" d="${ECG_PATH}"/><path class="ecg-pulse" d="${ECG_PATH}"/></svg>
          <span class="auth-pulse">${I.pulse}</span>
          <h2>Rejoins la plateforme de la promo</h2>
          <ul>
            <li>${I.check} Tous les cours du S2 et du S3, et bientôt plus</li>
            <li>${I.check} Recherche dans des centaines de fichiers</li>
            <li>${I.check} Plannings et annonces en temps réel</li>
            <li>${I.check} Gratuit pour les étudiants FMPC (@${esc(CFG.domaineGratuit || "etu.univh2c.ma")}) : une année au choix</li>
          </ul>
          <a class="auth-back" href="#/">← Retour</a>
        </aside>
        <div class="card auth-card" id="auth-card"></div>
      </div>`;
    renderAuthCard(mode);
  }

  function renderAuthCard(mode) {
    const card = $("#auth-card");
    const isUp = mode === "up";
    card.innerHTML = `
      <div class="seg auth-seg" role="tablist">
        <a role="tab" href="#/commencer" class="${isUp ? "active" : ""}">Créer un compte</a>
        <a role="tab" href="#/connexion" class="${!isUp ? "active" : ""}">Connexion</a>
      </div>
      <h1>${isUp ? "Crée ton compte" : "Bon retour !"}</h1>
      <p class="muted small">${isUp ? "Ça prend moins d'une minute." : "Connecte-toi pour accéder à tes cours."}</p>
      ${isUp ? `<div class="free-note">${I.check}<span><b>Gratuit</b> avec ton email <b>@${esc(CFG.domaineGratuit || "etu.univh2c.ma")}</b> : une année au choix, modifiable. Avec un autre email, chaque année d'études coûte ${esc(prixTexte())}.</span></div>` : ""}
      ${Store.demo ? '<p class="small muted"><b>Aperçu :</b> n\'importe quel email/mot de passe fonctionne.</p>' : ""}
      <form class="form" novalidate>
        ${isUp ? `<div class="form-row">
          <div class="field"><label for="s-prenom">Prénom</label><input id="s-prenom" class="input" name="prenom" required maxlength="40" autocomplete="given-name" placeholder="ex : Salma"></div>
          <div class="field"><label for="s-nom">Nom</label><input id="s-nom" class="input" name="nom" required maxlength="40" autocomplete="family-name" placeholder="ex : Bennani"></div>
        </div>` : ""}
        <div class="field"><label for="s-email">Email</label><input id="s-email" class="input" type="email" name="email" required autocomplete="email" placeholder="prenom.nom@exemple.com"></div>
        <div class="field"><label for="s-pw">Mot de passe</label><input id="s-pw" class="input" type="password" name="pw" required minlength="6" autocomplete="${isUp ? "new-password" : "current-password"}" placeholder="${isUp ? "6 caractères minimum" : ""}"></div>
        ${isUp ? `<div class="field"><label for="s-pw2">Confirme le mot de passe</label><input id="s-pw2" class="input" type="password" name="pw2" required minlength="6" autocomplete="new-password"></div>
        <label class="check small"><input type="checkbox" name="accept" required> J'accepte la <a href="#/confidentialite" target="_blank">politique de confidentialité</a></label>` : ""}
        <button type="submit" class="btn btn-lg" style="width:100%">${isUp ? "Créer mon compte" : "Se connecter"}</button>
        ${!isUp ? `<button type="button" class="link-btn" id="s-forgot" style="justify-self:center">Mot de passe oublié ?</button>` : ""}
      </form>`;
    const form = $("form", card);
    const fg = $("#s-forgot", card);
    if (fg) fg.onclick = () => forgotForm(form.email.value.trim());
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const email = form.email.value.trim(), pw = form.pw.value;
        if (isUp) {
          const prenom = form.prenom.value.trim(), nom = form.nom.value.trim();
          if (!prenom || !nom) throw new Error("Entre ton prénom et ton nom.");
          if (!email) throw new Error("Entre ton email.");
          if (pw.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
          if (pw !== form.pw2.value) throw new Error("Les deux mots de passe ne correspondent pas.");
          if (!form.accept.checked) throw new Error("Accepte la politique de confidentialité pour continuer.");
          const r = await Store.signUp(email, pw, `${prenom} ${nom}`);
          if (r.confirm) {
            card.innerHTML = `<div class="auth-done">
              <span class="auth-pulse">${I.mail}</span>
              <h1>Vérifie ta boîte mail</h1>
              <p>Un lien de confirmation a été envoyé à <b>${esc(email)}</b>. Clique dessus, puis reviens te connecter.</p>
              <p class="small muted">Pas reçu ? Regarde dans les spams.</p>
              <a class="btn" href="#/connexion">Aller à la connexion</a>
            </div>`;
            return;
          }
          toast(`Bienvenue ${prenom} !`);
        } else {
          if (!email || !pw) throw new Error("Email et mot de passe requis.");
          await Store.signIn(email, pw);
          toast("Connecté ✓");
        }
        location.hash = "#/";
      });
    };
  }

  /* ------------------------- Accès payant (par année) ------------------------- */
  const prixTexte = () => { const T = CFG.tarif || {}; return T.montant ? `${T.montant} ${T.devise || "DH"}` : "Prix à définir"; };
  const fmtJour = (d) => new Date(d + "T12:00:00").toLocaleDateString(window.I18N ? I18N.locale() : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const modeLabel = (m) => ({ en_ligne: "Paiement en ligne", virement: "Virement bancaire", cashplus: "CashPlus / Wafacash", admin: "Accès offert" }[m] || "—");
  const anneeNom = (fid, an) => `${(filiere(fid) || {}).nom || fid} · ${anneeLabel(fid, an)}`;
  const anneeCourt = (fid, an) => `${fid === "pharmacie" ? "Pharma" : "Méd."} ${an}A`;

  function paywallPage(f0, a0, verrou = false) {
    const u = Store.user(); const P = CFG.paiement || {}; const T = CFG.tarif || {};
    const dom = CFG.domaineGratuit || "etu.univh2c.ma";
    const ycpKey = P.youcanPay && P.youcanPay.clePublique;
    let fid = f0 || (u.choix && u.choix.filiere) || (u.demandes[0] && u.demandes[0].filiere) || CFG.filieres[0].id;
    let an = Number(a0 || (u.choix && u.choix.annee) || (u.demandes[0] && u.demandes[0].annee) || 1);
    const fin = fmtJour(window.finAnneeUniv());
    const contact = P.contact ? `<p class="small muted">Une question ? Contacte : <b>${esc(P.contact)}</b></p>` : "";
    const v = P.virement || {}, c = P.cashplus || {};
    const ligne = (k, val) => val ? `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>` : "";
    const detailsVir = ligne("Bénéficiaire", v.beneficiaire) + ligne("Banque", v.banque) + ligne("RIB", v.rib);
    const detailsCash = ligne("Bénéficiaire", c.beneficiaire) + ligne("Téléphone", c.telephone);

    main.innerHTML = `<div class="pay-wrap">
      <div class="pay-head">
        <span class="badge" style="background:var(--primary-50);color:var(--primary)">${u.univ ? "Gratuit · étudiant FMPC" : verrou ? "Année verrouillée" : "Accès aux cours"}</span>
        <h1>${u.univ ? (u.choix ? "Mon année" : "Choisis ton année") : verrou ? `Débloque ${esc(anneeNom(fid, an))}` : "Choisis ton année"}</h1>
        ${u.univ
          ? `<p class="muted">Avec ton email <b>@${esc(dom)}</b>, tu choisis <b>une année gratuite</b> et tu peux <b>la changer quand tu veux</b>.</p>`
          : `<p class="muted">Chaque année d'études coûte <b>${esc(prixTexte())}</b> et reste ouverte jusqu'au <b>${esc(fin)}</b>. Une année payée <b>ne peut pas être changée</b>. Avec un email <b>@${esc(dom)}</b>, une année au choix est gratuite.</p>`}
      </div>
      <div id="pay-pending"></div>
      ${u.univ ? "" : `<div class="pay-tip card card-pad">
        <span class="pay-tip-ico">${I.mail}</span>
        <div><b>Tu as un email @${esc(dom)} ?</b><p class="small muted">Crée ton compte avec cet email pour avoir une année gratuite. Tu es connecté avec <b>${esc(u.email)}</b>.</p></div>
        <button class="btn btn-ghost btn-sm" id="pw-switch">Changer de compte</button>
      </div>`}
      <section class="card card-pad pay-step">
        <h2><span class="step-n">1</span> Ton année d'études</h2>
        <div class="seg" role="tablist" id="pw-fil">${CFG.filieres.map((f) => `<a href="#" role="tab" data-f="${f.id}">${esc(f.nom)}</a>`).join("")}</div>
        <div class="pay-years" id="pw-years"></div>
      </section>
      <section class="pay-step2" id="pw-step2"></section>
      ${contact}
    </div>`;

    const sw = $("#pw-switch"); if (sw) sw.onclick = async () => { await Store.signOut(); location.hash = "#/commencer"; };

    function renderPending() {
      const box = $("#pay-pending"); const d = Store.user().demandes || [];
      box.innerHTML = d.length ? `<div class="card card-pad pay-wait-inline">
        <span class="auth-pulse" style="background:var(--warn-50);color:var(--warn)">${I.cal}</span>
        <div><b>Paiement en cours de vérification</b>
          <p class="small muted">${d.map((x) => `${esc(anneeNom(x.filiere, x.annee))} (${esc(modeLabel(x.mode))})`).join(" · ")}. L'admin va vérifier ta preuve et débloquer l'année.</p></div>
        <button class="btn btn-sm" id="pw-refresh">Vérifier</button>
      </div>` : "";
      const r = $("#pw-refresh", box);
      if (r) r.onclick = async () => {
        const nu = await Store.refreshUser();
        if (window.aAnnee(nu, fid, an)) { toast("Année débloquée ✓"); location.hash = `#/lecons/${fid}/${an}`; route(); }
        else toast("Toujours en attente de validation.");
      };
    }

    function render() {
      const user = Store.user();
      $$("#pw-fil a").forEach((x) => x.classList.toggle("active", x.dataset.f === fid));
      const f = filiere(fid);
      $("#pw-years").innerHTML = f.annees.map((a) => {
        const owned = window.aAnnee(user, fid, a.annee);
        const pend = (user.demandes || []).some((d) => d.filiere === fid && Number(d.annee) === a.annee);
        const sel = a.annee === an;
        const tag = owned ? `${I.check} ${user.univ ? "Ton année" : "Débloquée"}` : pend ? "En vérification" : user.univ ? "Gratuit" : esc(prixTexte());
        return `<button class="py ${sel ? "sel" : ""} ${owned ? "own" : ""}" data-a="${a.annee}" style="--fc:${f.couleur}">
          <b>${a.annee}</b><span>${esc(a.label)}</span>
          <small>${tag}</small></button>`;
      }).join("");
      $$("#pw-years .py").forEach((b) => (b.onclick = () => {
        const a = Number(b.dataset.a);
        if (window.aAnnee(Store.user(), fid, a)) { location.hash = `#/lecons/${fid}/${a}`; return; }
        an = a; render();
      }));

      const step2 = $("#pw-step2");
      if (window.aAnnee(user, fid, an)) { step2.innerHTML = ""; return; }
      if (user.univ) {
        const cur = user.choix;
        step2.innerHTML = `<div class="pay-sum card card-pad free-sum">
            <span><b>${esc(anneeNom(fid, an))}</b><small class="muted">${cur ? `Remplace ${esc(anneeNom(cur.filiere, cur.annee))} · ` : ""}gratuit avec ton email FMPC · modifiable à tout moment</small></span>
            <button class="btn btn-lg" id="pw-choose">${cur ? "Passer à cette année" : "Choisir cette année"}</button>
          </div>`;
        $("#pw-choose", step2).onclick = async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try { await Store.choisirAnnee(fid, an); toast("Année choisie ✓"); location.hash = `#/lecons/${fid}/${an}`; route(); }
          catch (err) { toast(err.message, true); b.disabled = false; }
        };
        return;
      }
      const pend = (user.demandes || []).some((d) => d.filiere === fid && Number(d.annee) === an);
      step2.innerHTML = `
        <div class="pay-sum card card-pad"><span><b>${esc(anneeNom(fid, an))}</b><small class="muted">Accès jusqu'au ${esc(fin)}</small></span><b class="pay-price">${esc(prixTexte())}</b></div>
        ${pend ? `<div class="form-error" style="background:var(--warn-50);color:var(--warn)">Une demande pour cette année est déjà en cours de vérification.</div>` : ""}
        <h2 class="pay-h2"><span class="step-n">2</span> Paiement</h2>
        <div class="pay-grid ${ycpKey || P.lienEnLigne ? "" : "pay-one"}">
          ${ycpKey || P.lienEnLigne ? `<section class="card card-pad pay-opt">
            <span class="pay-ico" style="background:var(--info-50);color:var(--info)">${I.card}</span>
            <h3>Payer par carte</h3>
            <p class="muted small">Carte marocaine ou internationale. ${ycpKey ? "L'année se débloque <b>automatiquement</b>." : ""}</p>
            ${ycpKey
              ? `<button class="btn btn-lg" id="pw-card" ${T.montant ? "" : "disabled"}>${I.card} Payer ${esc(prixTexte())}</button>
                 <p class="small muted">Paiement sécurisé par YouCan Pay : tes données de carte ne passent pas par MedFMPC.</p>`
              : `<a class="btn btn-lg" href="${esc(safeUrl(P.lienEnLigne))}" target="_blank" rel="noopener">Payer en ligne ${I.ext}</a>`}
          </section>` : ""}
          <section class="card card-pad pay-opt">
            <span class="pay-ico" style="background:var(--warn-50);color:var(--warn)">${I.bank}</span>
            <h3>Virement ou CashPlus</h3>
            <p class="muted small">Paie, puis envoie la photo du reçu. L'admin débloque l'année après vérification.</p>
            <div class="seg pay-seg" role="tablist"><a href="#" data-pm="virement" class="active">Virement</a><a href="#" data-pm="cashplus">CashPlus / Wafacash</a></div>
            <dl class="pay-details" data-for="virement">${detailsVir || '<div><dd class="muted">Coordonnées bancaires à venir.</dd></div>'}</dl>
            <dl class="pay-details" data-for="cashplus" hidden>${detailsCash || '<div><dd class="muted">Coordonnées CashPlus à venir.</dd></div>'}</dl>
            <p class="small muted">Montant : <b>${esc(prixTexte())}</b> · Motif : <b>${esc(user.email)}</b> · <b>${esc(anneeCourt(fid, an))}</b></p>
            <form class="form" novalidate>
              <div class="field"><label>Preuve de paiement</label>${dropzoneHtml("preuve", "image/*,application/pdf", "Photo du reçu ou capture du virement")}</div>
              <button type="submit" class="btn">Envoyer ma preuve</button>
            </form>
          </section>
        </div>`;
      let mode = "virement";
      $$(".pay-seg a", step2).forEach((a) => a.onclick = (e) => {
        e.preventDefault(); mode = a.dataset.pm;
        $$(".pay-seg a", step2).forEach((x) => x.classList.toggle("active", x === a));
        $$(".pay-details", step2).forEach((d) => (d.hidden = d.dataset.for !== mode));
      });
      const form = $(".pay-opt form", step2); wireDropzones(form);
      form.onsubmit = (e) => {
        e.preventDefault();
        withBusy(form, async () => {
          const file = form.preuve.files[0];
          if (!file) throw new Error("Ajoute la photo du reçu ou la capture du virement.");
          checkFile(file);
          await Store.demanderAcces(fid, an, mode, file);
          toast("Preuve envoyée ✓"); renderPending(); render();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      };
      const cardBtn = $("#pw-card", step2);
      if (cardBtn) cardBtn.onclick = () => openCardPayment(ycpKey, fid, an);
    }
    $$("#pw-fil a").forEach((x) => (x.onclick = (e) => { e.preventDefault(); fid = x.dataset.f; an = 1; render(); }));
    renderPending(); render();
  }

  const loadedScripts = {};
  function loadScriptOnce(src) {
    if (!loadedScripts[src]) loadedScripts[src] = new Promise((res, rej) => {
      const el = document.createElement("script"); el.src = src; el.onload = res;
      el.onerror = () => { delete loadedScripts[src]; rej(new Error("Impossible de charger le module de paiement. Vérifie ta connexion.")); };
      document.head.appendChild(el);
    });
    return loadedScripts[src];
  }

  async function waitActivation(box, fid, an) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const u = await Store.refreshUser();
      if (window.aAnnee(u, fid, an)) { closeModal(); toast("Année débloquée ✓ Bonne révision !"); location.hash = `#/lecons/${fid}/${an}`; route(); return; }
    }
    box.innerHTML = `<div class="auth-done"><span class="auth-pulse">${I.check}</span><h3>Paiement reçu</h3>
      <p>Le déblocage prend un peu plus de temps que prévu. Recharge la page dans quelques minutes.</p></div>`;
  }

  async function openCardPayment(pubKey, fid, an) {
    const fin = fmtJour(window.finAnneeUniv());
    const body = openModal("Paiement par carte", `
      <div class="ycp-box" id="ycp-box">
        <div class="ycp-sum"><span>${esc(anneeNom(fid, an))}<small class="muted" style="display:block">Accès jusqu'au ${esc(fin)}</small></span><b>${esc(prixTexte())}</b></div>
        <div id="ycp-form" class="ycp-form"><div class="spinner"></div></div>
        <div class="form-error" id="ycp-err" hidden></div>
        <button class="btn btn-lg" id="ycp-pay" style="width:100%" disabled>Payer ${esc(prixTexte())}</button>
        <p class="small muted" style="text-align:center;margin:0">Paiement sécurisé par YouCan Pay</p>
      </div>`);
    const err = $("#ycp-err", body), btn = $("#ycp-pay", body), form = $("#ycp-form", body), box = $("#ycp-box", body);
    const showErr = (m) => { err.textContent = m; err.hidden = false; };
    try {
      if (Store.demo) {
        form.innerHTML = `<p class="small muted"><b>Aperçu :</b> formulaire simulé. Sur le vrai site, le formulaire sécurisé de YouCan Pay s'affiche ici.</p>
          <div class="field"><label>Numéro de carte</label><input class="input" value="4242 4242 4242 4242" readonly></div>
          <div class="form-row"><div class="field"><label>Expiration</label><input class="input" value="12/29" readonly></div><div class="field"><label>CVV</label><input class="input" value="123" readonly></div></div>`;
        btn.disabled = false;
        btn.onclick = async () => { btn.disabled = true; btn.textContent = "Paiement en cours…"; await new Promise((r) => setTimeout(r, 800)); await Store.demoPayer(fid, an); closeModal(); toast("Paiement réussi · année débloquée ✓"); location.hash = `#/lecons/${fid}/${an}`; route(); };
        return;
      }
      const { token } = await Store.payToken(fid, an);
      await loadScriptOnce("https://youcanpay.com/yp.js");
      form.innerHTML = "";
      const el = window.yp(pubKey, { locale: window.I18N && I18N.lang() === "ar" ? "ar" : window.I18N && I18N.lang() === "en" ? "en" : "fr" }).elements({ token, container: "#ycp-form" });
      el.on("error", (e) => showErr(e.message || "Erreur de paiement."));
      await el.mount();
      btn.disabled = false;
      btn.onclick = async () => {
        err.hidden = true; btn.disabled = true; btn.textContent = "Paiement en cours…";
        const r = await el.confirm();
        if (r.status === "succeeded") {
          box.innerHTML = `<div class="auth-done"><span class="auth-pulse">${I.check}</span><h3>Paiement réussi !</h3><p>Déblocage de ton année en cours…</p><div class="spinner" style="margin:6px 0"></div></div>`;
          waitActivation(box, fid, an);
        } else {
          showErr((r.error && r.error.message) || "Le paiement a échoué. Réessaie ou utilise une autre carte.");
          btn.disabled = false; btn.textContent = `Payer ${prixTexte()}`;
        }
      };
    } catch (e) {
      form.innerHTML = "";
      showErr(e.message || String(e));
    }
  }

  function suspendedWall() {
    main.innerHTML = emptyState("Compte suspendu", `Ton compte a été désactivé par l'administrateur.<br>Contacte-le si tu penses que c'est une erreur.<br><br><button class="btn btn-ghost" id="wall-logout">Se déconnecter</button>`, I.users);
    const b = $("#wall-logout"); if (b) b.onclick = () => Store.signOut();
  }

  async function route() {
    if (route.flush) { const f = route.flush; route.flush = null; try { await f(); } catch (e) {} }
    const raw = location.hash.replace(/^#\/?/, "");
    const [pathStr, qs] = raw.split("?");
    const parts = pathStr.split("/").filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(qs || "");
    const page = parts[0] || "accueil";
    $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === page));
    $("#nav").classList.remove("open");
    $("#menu-btn").setAttribute("aria-expanded", "false");
    const titles = { accueil: "Accueil", actualites: "Actualités", planning: "Planning", lecons: "Leçons", admin: "Espace admin", confidentialite: "Confidentialité", fichier: "Document", notes: "Mes notes", assistant: "Assistant IA" };
    document.title = T(`${titles[page] || "MedFMPC"} — ${CFG.nomSite}`);
    const u = Store.user();
    renderHeader();
    if (u && u.actif === false) return suspendedWall();
    if (CFG.inscriptionObligatoire && !u) {
      document.body.classList.add("public");
      if (page === "commencer") { document.title = T(`Créer un compte — ${CFG.nomSite}`); return authPage("up"); }
      if (page === "connexion") { document.title = T(`Connexion — ${CFG.nomSite}`); return authPage("in"); }
      if (page !== "confidentialite") { document.title = T(CFG.nomSite); return landingPage(); }
    } else document.body.classList.remove("public");
    if (u && (page === "commencer" || page === "connexion")) { location.replace("#/"); return; }
    if (u && !u.acces) {
      document.body.classList.add("public");
      if (page !== "confidentialite") { document.title = T(`Accès — ${CFG.nomSite}`); return paywallPage(); }
    }
    if (u && page === "acces") { document.title = T(`Accès — ${CFG.nomSite}`); return paywallPage(parts[1], parts[2]); }
    try {
      if (page === "accueil") await pageAccueil();
      else if (page === "actualites") await pageActualites(params);
      else if (page === "planning") await pagePlanning(params);
      else if (page === "lecons") await pageLecons(parts.slice(1));
      else if (page === "admin") await pageAdmin(params);
      else if (page === "confidentialite") pageConfidentialite();
      else if (page === "fichier") await pageFichier(parts[1]);
      else if (page === "notes") await pageNotes();
      else if (page === "assistant") pageAssistant();
      else notFound();
    } catch (e) {
      console.error(e);
      main.innerHTML = emptyState("Erreur de chargement", esc(e.message || String(e)) + "<br>Vérifie ta connexion et la configuration Supabase.");
    }
    if (route._last !== page) { window.scrollTo(0, 0); route._last = page; }
  }

  /* ------------------------ actions (délégation) ---------------------- */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action],[data-del],[data-edit-news],[data-view-plan],[data-view-lesson]");
    if (!t) return;
    if (e.target.closest("[data-stop]")) return; // liens téléchargement dans une ligne
    if (t.dataset.action) {
      const a = t.dataset.action;
      if (a === "login") { if (CFG.inscriptionObligatoire && !Store.user()) { location.hash = "#/connexion"; return; } return loginForm(); }
      if (a === "signup") { location.hash = "#/commencer"; return; }
      if (a === "new-news") return newsForm();
      if (a === "new-planning") return planningForm({ filiere: new URLSearchParams(location.hash.split("?")[1]).get("filiere") || undefined });
      if (a === "new-lesson") return lessonForm({ filiere: t.dataset.filiere, annee: t.dataset.annee, semestre: t.dataset.semestre });
      if (a === "reset-demo") { Store.reset(); toast("Démo réinitialisée"); return route(); }
    }
    if (t.dataset.del) {
      const [table, id] = t.dataset.del.split(":");
      const row = rowsCache[table].get(id);
      if (!row) return;
      if (!(await confirmBox(`Supprimer « ${row.titre} » ? Cette action est définitive.`))) return;
      try { await Store.remove(table, row); toast("Supprimé"); route(); } catch (err) { toast(err.message, true); }
      return;
    }
    if (t.dataset.editNews) { const row = rowsCache.news.get(t.dataset.editNews); if (row) newsForm(row); return; }
    if (t.dataset.viewPlan) {
      const p = rowsCache.plannings.get(t.dataset.viewPlan);
      if (p) previewFile({ title: p.titre, url: p.fichier_url, type: p.type, download: p.fichier_url, open: p.type === "pdf" ? p.fichier_url : null });
      return;
    }
    if (t.dataset.viewLesson) {
      const l = rowsCache.lessons.get(t.dataset.viewLesson);
      if (l) previewFile({ title: l.titre, url: l.fichier_url, type: /\.pdf(\?|$)/i.test(l.fichier_url) ? "pdf" : "image", download: l.fichier_url });
      return;
    }
  });

  /* ------------------------------ en-tête ----------------------------- */
  function renderHeader() {
    const u = Store.user();
    $("#btn-login").hidden = !!u;
    $("#user-chip").hidden = !u;
    $("#nav-admin").hidden = !(u && (u.role === "admin" || u.role === "editor"));
    const nn = $("#nav-notes");
    if (nn) nn.hidden = !(u && u.acces);
    const ni = $("#nav-ia");
    if (ni) ni.hidden = !(u && u.acces);
    const na = $("#nav-annee");
    if (na) {
      na.hidden = !(u && !u.full && u.acces);
      if (u && u.choix) na.textContent = `Mon année · ${anneeCourt(u.choix.filiere, u.choix.annee)}`;
      else if (u && u.annees && u.annees.length) na.textContent = "Mes années";
    }
    if (u) {
      $("#user-name").textContent = u.nom;
      $("#user-role").textContent = roleLabel(u.role);
      $("#user-avatar").textContent = (u.nom || u.email || "?").trim().charAt(0).toUpperCase();
    }
  }
  $("#btn-login").onclick = () => { if (CFG.inscriptionObligatoire) location.hash = "#/connexion"; else loginForm(); };
  $("#btn-logout").onclick = async () => { await Store.signOut(); toast("Déconnecté"); if (location.hash.startsWith("#/admin")) location.hash = "#/"; };
  $("#menu-btn").onclick = () => {
    const open = $("#nav").classList.toggle("open");
    $("#menu-btn").setAttribute("aria-expanded", String(open));
  };

  async function ensureSnapshot() {
    const u = Store.user();
    if (u && u.acces && Store.loadSnapshot) { try { await Store.loadSnapshot(); } catch (e) { console.error(e); } }
  }

  /* ------------------------------ démarrage --------------------------- */
  function setupTheme() {
    const btn = $("#theme-btn"); if (!btn) return;
    const isDark = () => {
      const t = document.documentElement.getAttribute("data-theme");
      return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    btn.onclick = () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("medfmpc-theme", next); } catch (e) {}
    };
  }

  async function start() {
    setupTheme();
    window.addEventListener("langchange", () => { renderHeader(); route(); });
    $("#brand-name").textContent = CFG.nomSite;
    $("#brand-fac").textContent = "FMP Casablanca";
    $("#footer-fac").textContent = CFG.faculte;
    $("#demo-banner").hidden = !Store.demo;
    try { await Store.init(); }
    catch (e) {
      console.error(e);
      main.innerHTML = emptyState("Connexion impossible", "Le site n'a pas pu joindre la base de données. " + esc(e.message));
      return;
    }
    Store.onAuth(async () => { renderHeader(); await ensureSnapshot(); route(); });
    Store.onRecovery(() => newPasswordForm());
    renderHeader();
    await ensureSnapshot();
    window.addEventListener("hashchange", route);
    route();
    if (Store.pingVisite) Store.pingVisite();
  }
  start();
})();
