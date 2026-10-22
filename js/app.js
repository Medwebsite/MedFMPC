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
  const fmtDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  function timeAgo(d) {
    const s = (Date.now() - new Date(d).getTime()) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) { const j = Math.floor(s / 86400); return `il y a ${j} jour${j > 1 ? "s" : ""}`; }
    return fmtDate(d);
  }
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
  const roleLabel = (r) => ({ admin: "Admin principal", editor: "Éditeur", user: "Lecture seule" }[r] || r);

  function toast(msg, err = false) {
    const t = $("#toast");
    t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = "toast"), 3200);
  }

  /* ------------------------------ icônes ------------------------------ */
  const I = {
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

  function loginForm() {
    const body = openModal("Espace éditeurs", `
      <div class="tabs"><button class="active" data-tab="in">Connexion</button><button data-tab="up">Créer un compte</button></div>
      ${Store.demo ? '<p class="small muted">Mode démo : n\'importe quel email/mot de passe te connecte en tant qu\'admin.</p>' : '<p class="small muted">Les visiteurs n\'ont pas besoin de compte. Après inscription, l\'admin principal doit te nommer « éditeur » pour publier.</p>'}
      <form class="form" novalidate>
        <div class="field" data-only="up" hidden><label for="a-nom">Nom affiché</label><input id="a-nom" class="input" name="nom" placeholder="ex : Délégué 2A" maxlength="60"></div>
        <div class="field"><label for="a-email">Email</label><input id="a-email" class="input" type="email" name="email" required autocomplete="email"></div>
        <div class="field"><label for="a-pw">Mot de passe</label><input id="a-pw" class="input" type="password" name="pw" required minlength="6" autocomplete="current-password"></div>
        <div class="form-actions"><button type="submit" class="btn" style="width:100%">Se connecter</button></div>
      </form>`);
    let mode = "in";
    const form = $("form", body);
    $$(".tabs button", body).forEach((b) => b.onclick = () => {
      mode = b.dataset.tab;
      $$(".tabs button", body).forEach((x) => x.classList.toggle("active", x === b));
      $$("[data-only=up]", body).forEach((x) => (x.hidden = mode !== "up"));
      $("button[type=submit]", form).textContent = mode === "up" ? "Créer mon compte" : "Se connecter";
      $("#a-pw").autocomplete = mode === "up" ? "new-password" : "current-password";
    });
    form.onsubmit = (e) => {
      e.preventDefault();
      withBusy(form, async () => {
        const email = form.email.value.trim(), pw = form.pw.value;
        if (!email || !pw) throw new Error("Email et mot de passe requis.");
        if (mode === "up") {
          if (pw.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
          const r = await Store.signUp(email, pw, form.nom.value.trim());
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
        ${f.annees.map((a) => `<a class="year ${a.semestres.some((x) => x.drive) ? "has" : ""}" href="#/lecons/${f.id}/${a.annee}"><b>${a.annee}</b><span>${esc(a.label)}</span>
          <span class="sems">${a.semestres.map((x) => `<i class="${x.drive ? "on" : ""}" title="${x.drive ? "Cours disponibles" : "Bientôt"}">${x.code}</i>`).join("")}</span></a>`).join("")}
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
        crumbs += i === path.length - 1 ? `<span class="cur">${esc(nm)}</span>` : `<a href="${base}/${path.slice(0, i + 1).join("/")}">${esc(nm)}</a>`;
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
        <div class="chips" aria-label="Années">${f.annees.map((x) => `<a class="chip ${x.annee === a.annee ? "active" : ""}" href="#/lecons/${f.id}/${x.annee}">${x.annee}<span class="chip-sub">${x.annee === 1 ? "ère" : "ème"}</span></a>`).join("")}</div>
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
      zone.innerHTML = `<section class="card explorer"><iframe class="embed-folder" src="${Drive.embedFolderUrl(currentId)}" title="Dossier Drive"></iframe></section>`;
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
      const q = e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      $$("#ex-items > li").forEach((li) => {
        const n = (li.dataset.name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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
      <a class="item-link" href="${esc(Drive.viewUrl(it))}" target="_blank" rel="noopener" title="Ouvrir dans Google Drive">
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
      const members = await Store.members();
      box.innerHTML = `
        <p class="small muted">Les personnes créent leur compte via « Connexion → Créer un compte », puis tu leur donnes le rôle <b>Éditeur</b> ici. Les visiteurs n'ont besoin d'aucun compte pour voir et télécharger.</p>
        <div class="card table-wrap"><table class="tbl">
          <thead><tr><th>Nom</th><th>Email</th><th>Inscrit</th><th>Rôle</th></tr></thead>
          <tbody>${members.map((m) => `<tr>
            <td><b>${esc(m.nom || "—")}</b></td><td>${esc(m.email)}</td><td class="muted">${fmtDate(m.created_at)}</td>
            <td>${m.id === u.id || m.role === "admin" ? `<span class="badge b-pin">${roleLabel(m.role)}</span>` : `
              <select class="input" data-role="${esc(m.id)}">
                <option value="user" ${m.role === "user" ? "selected" : ""}>Lecture seule</option>
                <option value="editor" ${m.role === "editor" ? "selected" : ""}>Éditeur</option>
              </select>`}</td></tr>`).join("")}</tbody>
        </table></div>`;
      $$("[data-role]", box).forEach((s) => (s.onchange = async () => {
        try { await Store.setRole(s.dataset.role, s.value); toast("Rôle mis à jour ✓"); }
        catch (e) { toast(e.message, true); }
      }));
      return;
    }

    if (tab === "drive" && isAdmin()) {
      box.innerHTML = `
        <p class="small muted">Ces liens se modifient dans <code>js/config.js</code> (champ <code>drive</code> de chaque semestre). ${Drive.live() ? "Clé API Google : <span class='ok'>configurée</span> — le Drive est lu en direct." : `Clé API Google : <span class='ko'>absente</span> — le site utilise la copie du Drive du ${esc(Drive.snapshotDate())}.`}</p>
        <div class="grid grid-2">${CFG.filieres.map((f) => `<div class="card card-pad"><h3>${esc(f.nom)}</h3><div class="status-list">
          ${f.annees.flatMap((a) => a.semestres.map((x) => `<div><span>${esc(a.label)} · ${x.code}</span>${x.drive ? `<a class="ok" href="${Drive.folderUrl(x.drive)}" target="_blank" rel="noopener">lié ✓</a>` : `<span class="ko">non lié</span>`}</div>`)).join("")}
        </div></div>`).join("")}</div>
        ${Store.demo ? `<p style="margin-top:16px"><button class="btn btn-ghost btn-sm" data-action="reset-demo">Réinitialiser les données de démo</button></p>` : ""}`;
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

  function notFound() {
    main.innerHTML = emptyState("Page introuvable", `<a href="#/">Retour à l'accueil</a>`);
  }

  /* ------------------------------ routeur ----------------------------- */
  async function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [pathStr, qs] = raw.split("?");
    const parts = pathStr.split("/").filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(qs || "");
    const page = parts[0] || "accueil";
    $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === page));
    $("#nav").classList.remove("open");
    $("#menu-btn").setAttribute("aria-expanded", "false");
    const titles = { accueil: "Accueil", actualites: "Actualités", planning: "Planning", lecons: "Leçons", admin: "Espace admin" };
    document.title = `${titles[page] || "MedFMPC"} — ${CFG.nomSite}`;
    try {
      if (page === "accueil") await pageAccueil();
      else if (page === "actualites") await pageActualites(params);
      else if (page === "planning") await pagePlanning(params);
      else if (page === "lecons") await pageLecons(parts.slice(1));
      else if (page === "admin") await pageAdmin(params);
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
      if (a === "login") return loginForm();
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
    $("#nav-admin").hidden = !u;
    if (u) {
      $("#user-name").textContent = u.nom;
      $("#user-role").textContent = roleLabel(u.role);
      $("#user-avatar").textContent = (u.nom || u.email || "?").trim().charAt(0).toUpperCase();
    }
  }
  $("#btn-login").onclick = loginForm;
  $("#btn-logout").onclick = async () => { await Store.signOut(); toast("Déconnecté"); if (location.hash.startsWith("#/admin")) location.hash = "#/"; };
  $("#menu-btn").onclick = () => {
    const open = $("#nav").classList.toggle("open");
    $("#menu-btn").setAttribute("aria-expanded", String(open));
  };

  /* ------------------------------ démarrage --------------------------- */
  async function start() {
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
    Store.onAuth(() => { renderHeader(); route(); });
    renderHeader();
    window.addEventListener("hashchange", route);
    route();
  }
  start();
})();
