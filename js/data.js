/* =====================================================================
   Couche de données : Supabase (en ligne) ou mode démo (local)
   + lecture de Google Drive
   ===================================================================== */
(function () {
  const CFG = window.APP_CONFIG;
  const BUCKET = "fichiers";
  const DEMO_KEY = "medfmpc-demo-v5";

  const loadScript = (src) =>
    new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("Script introuvable : " + src));
      document.head.appendChild(s);
    });

  const slugFile = (name) => {
    const dot = name.lastIndexOf(".");
    const base = (dot > 0 ? name.slice(0, dot) : name)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "fichier";
    const ext = dot > 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
    return base + ext;
  };

  const today = () => new Date().toISOString().slice(0, 10);
  const domaineGratuit = () => (CFG.domaineGratuit || "etu.univh2c.ma").toLowerCase();
  // Accès : admin/éditeur = tout ; email FMPC = 1 année choisie (modifiable) ;
  // autres = années payées (non modifiables)
  function accesInfo(email, role, annees, demandes, choix) {
    const univ = String(email || "").toLowerCase().endsWith("@" + domaineGratuit());
    const full = role === "admin" || role === "editor";
    const valides = (annees || []).filter((x) => x.jusqu >= today());
    const ch = univ && choix && choix.filiere && choix.annee ? { filiere: choix.filiere, annee: Number(choix.annee) } : null;
    return {
      univ, full, choix: ch,
      annees: valides,
      demandes: (demandes || []).filter((d) => d.statut === "en_attente"),
      acces: full || !!ch || valides.length > 0,
    };
  }
  function aAnnee(user, f, a) {
    if (!user) return false;
    if (user.full) return true;
    if (user.choix && user.choix.filiere === f && user.choix.annee === Number(a)) return true;
    return (user.annees || []).some((x) => x.filiere === f && Number(x.annee) === Number(a));
  }
  window.aAnnee = aAnnee;
  // Fin de l'année universitaire : 30 septembre
  function finAnneeUniv() {
    const d = new Date(); const y = d.getMonth() >= 9 ? d.getFullYear() + 1 : d.getFullYear();
    return `${y}-09-30`;
  }
  window.finAnneeUniv = finAnneeUniv;
  window.accesInfo = accesInfo;

  /* ------------------------------------------------------------------ */
  /*  Implémentation SUPABASE                                            */
  /* ------------------------------------------------------------------ */
  function supabaseStore() {
    let sb = null;
    let listeners = [];
    let currentUser = null;

    async function loadProfile(session) {
      if (!session) { currentUser = null; return null; }
      const u = session.user;
      const [{ data }, ann, dem] = await Promise.all([
        sb.from("profiles").select("*").eq("id", u.id).maybeSingle(),
        sb.from("acces_annees").select("filiere,annee,jusqu").eq("user_id", u.id),
        sb.from("demandes_acces").select("*").eq("user_id", u.id).eq("statut", "en_attente"),
      ]);
      const role = (data && data.role) || "user";
      currentUser = {
        id: u.id,
        email: u.email,
        nom: (data && data.nom) || u.email.split("@")[0],
        role,
        actif: data ? data.actif !== false : true,
        ...accesInfo(u.email, role, ann.data || [], dem.data || [], data && { filiere: data.filiere_choisie, annee: data.annee_choisie }),
      };
      return currentUser;
    }

    let recoveryFn = null;

    return {
      demo: false,
      async init() {
        await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js");
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
        const { data } = await sb.auth.getSession();
        await loadProfile(data.session);
        sb.auth.onAuthStateChange(async (evt, session) => {
          const before = currentUser && currentUser.id;
          await loadProfile(session);
          if (evt === "PASSWORD_RECOVERY" && recoveryFn) recoveryFn();
          if (evt === "SIGNED_IN") sb.rpc("touch_last_seen").then(() => {}, () => {});
          if (before !== (currentUser && currentUser.id)) listeners.forEach((f) => f(currentUser));
        });
      },
      user: () => currentUser,
      onAuth(fn) { listeners.push(fn); },
      onRecovery(fn) { recoveryFn = fn; },
      async refreshUser() {
        const { data } = await sb.auth.getSession();
        await loadProfile(data.session);
        listeners.forEach((f) => f(currentUser));
        return currentUser;
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(traduire(error.message));
        return this.refreshUser();
      },
      async signUp(email, password, nom) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { nom }, emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw new Error(traduire(error.message));
        if (!data.session) return { confirm: true };
        await this.refreshUser();
        return { confirm: false };
      },
      async signOut() { await sb.auth.signOut(); currentUser = null; listeners.forEach((f) => f(null)); },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
        if (error) throw new Error(traduire(error.message));
      },
      async updatePassword(pw) {
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) throw new Error(traduire(error.message));
        await this.refreshUser();
      },
      async pingVisite() { try { await sb.rpc("ping_visite"); } catch (e) {} },
      async statsVisites() {
        const { data } = await sb.rpc("stats_visites");
        return data || { total: 0, jour: 0, semaine: 0 };
      },
      async setActif(id, actif) {
        const { error } = await sb.from("profiles").update({ actif }).eq("id", id);
        if (error) throw new Error(traduire(error.message));
      },
      // --- Cours (copie du Drive protégée) ---
      async loadSnapshot() {
        const { data, error } = await sb.from("drive_snapshot").select("cle,data,updated_at");
        if (error || !data) return;
        const folders = {}; let upd = "";
        data.filter((r) => r.cle !== "stats").forEach((r) => { Object.assign(folders, r.data); if (r.updated_at > upd) upd = r.updated_at; });
        window.Drive.setSnapshot(folders, upd ? upd.slice(0, 10) : "");
      },
      async publicStats() {
        const { data } = await sb.from("drive_snapshot").select("data").eq("cle", "stats").maybeSingle();
        return data ? data.data : null;
      },
      async importSnapshot(json) {
        const rows = json.semestres.map((x) => ({ cle: x.racine, filiere: x.filiere, annee: x.annee, data: x.dossiers, updated_at: new Date().toISOString() }));
        rows.push({ cle: "stats", data: json.stats, updated_at: new Date().toISOString() });
        const { error } = await sb.from("drive_snapshot").upsert(rows);
        if (error) throw new Error(traduire(error.message));
        await this.loadSnapshot();
      },
      // --- Année gratuite (email FMPC) ---
      async choisirAnnee(filiere, annee) {
        const { error } = await sb.rpc("choisir_annee", { f: filiere, a: Number(annee) });
        if (error) throw new Error(traduire(error.message));
        await this.refreshUser();
        await this.loadSnapshot();
      },
      // --- Paiement (par année d'études) ---
      async demanderAcces(filiere, annee, mode, file) {
        let path = null;
        if (file) {
          path = `${currentUser.id}/${Date.now()}-${slugFile(file.name)}`;
          const { error } = await sb.storage.from("preuves").upload(path, file, { upsert: false, contentType: file.type || undefined });
          if (error) throw new Error(traduire(error.message));
        }
        const { error } = await sb.from("demandes_acces").insert({ filiere, annee: Number(annee), mode, preuve: path });
        if (error) throw new Error(traduire(error.message));
        await this.refreshUser();
      },
      async payToken(filiere, annee) {
        const { data, error } = await sb.functions.invoke("paiement-token", { body: { filiere, annee: Number(annee) } });
        if (error) {
          let msg = error.message;
          try { const c = await error.context.json(); msg = c.error || msg; } catch (e) {}
          throw new Error(msg);
        }
        return data;
      },
      async preuveUrl(path) {
        const { data, error } = await sb.storage.from("preuves").createSignedUrl(path, 3600);
        if (error) throw new Error(traduire(error.message));
        return data.signedUrl;
      },
      async validerDemande(id) {
        const { error } = await sb.rpc("valider_demande", { did: id });
        if (error) throw new Error(traduire(error.message));
      },
      async refuserDemande(id) {
        const { error } = await sb.from("demandes_acces").update({ statut: "refusee" }).eq("id", id);
        if (error) throw new Error(traduire(error.message));
      },
      async donnerAcces(uid, filiere, annee) {
        const { error } = await sb.from("acces_annees").upsert({ user_id: uid, filiere, annee: Number(annee), jusqu: finAnneeUniv(), source: "admin" });
        if (error) throw new Error(traduire(error.message));
      },
      async retirerAcces(uid, filiere, annee) {
        const { error } = await sb.from("acces_annees").delete().eq("user_id", uid).eq("filiere", filiere).eq("annee", Number(annee));
        if (error) throw new Error(traduire(error.message));
      },

      // --- Notes personnelles (privées : chaque étudiant ne voit que les siennes) ---
      async getNote(fichier) {
        const { data, error } = await sb.from("notes").select("contenu,updated_at").eq("user_id", currentUser.id).eq("fichier", fichier).maybeSingle();
        if (error) throw new Error(traduire(error.message));
        return data;
      },
      async saveNote(fichier, { contenu, nom, contexte }) {
        if (!contenu.trim()) return this.deleteNote(fichier);
        const { error } = await sb.from("notes").upsert({ user_id: currentUser.id, fichier, nom, contexte, contenu, updated_at: new Date().toISOString() });
        if (error) throw new Error(traduire(error.message));
      },
      async listNotes() {
        const { data, error } = await sb.from("notes").select("fichier,nom,contexte,contenu,updated_at").eq("user_id", currentUser.id).order("updated_at", { ascending: false });
        if (error) throw new Error(traduire(error.message));
        return data || [];
      },
      async deleteNote(fichier) {
        const { error } = await sb.from("notes").delete().eq("user_id", currentUser.id).eq("fichier", fichier);
        if (error) throw new Error(traduire(error.message));
      },

      async list(table, filters = {}) {
        let q = sb.from(table).select("*");
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") q = q.eq(k, v);
        });
        const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
        if (error) throw error;
        return data || [];
      },
      async insert(table, row) {
        const { data, error } = await sb.from(table)
          .insert({ ...row, auteur_nom: currentUser ? currentUser.nom : null }).select().single();
        if (error) throw new Error(traduire(error.message));
        return data;
      },
      async update(table, id, patch) {
        const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
        if (error) throw new Error(traduire(error.message));
        return data;
      },
      async remove(table, row) {
        const { error } = await sb.from(table).delete().eq("id", row.id);
        if (error) throw new Error(traduire(error.message));
        const paths = [row.fichier_path, row.image_path].filter(Boolean);
        if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      },
      async upload(file, dossier) {
        const path = `${dossier}/${Date.now()}-${slugFile(file.name)}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
        if (error) throw new Error(traduire(error.message));
        const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
        return { url: data.publicUrl, path };
      },
      async removeFile(path) { if (path) await sb.storage.from(BUCKET).remove([path]); },
      async members() {
        const [pr, ac, de] = await Promise.all([
          sb.from("profiles").select("*").order("created_at", { ascending: true }),
          sb.from("acces_annees").select("*"),
          sb.from("demandes_acces").select("*").eq("statut", "en_attente").order("created_at", { ascending: true }),
        ]);
        if (pr.error) throw pr.error;
        return (pr.data || []).map((m) => ({
          ...m,
          acces_list: (ac.data || []).filter((x) => x.user_id === m.id),
          demandes_list: (de.data || []).filter((x) => x.user_id === m.id),
        }));
      },
      async setRole(id, role) {
        const { error } = await sb.from("profiles").update({ role }).eq("id", id);
        if (error) throw new Error(traduire(error.message));
      },
    };
  }

  function traduire(msg) {
    const m = String(msg || "");
    if (/Invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect.";
    if (/Email not confirmed/i.test(m)) return "Confirme d'abord ton email (regarde ta boîte de réception).";
    if (/already registered/i.test(m)) return "Un compte existe déjà avec cet email.";
    if (/Password should be at least/i.test(m)) return "Le mot de passe doit contenir au moins 6 caractères.";
    if (/row-level security|violates row-level/i.test(m)) return "Action refusée : ton compte n'a pas les droits d'éditeur.";
    if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return "Fichier trop volumineux (max 50 Mo).";
    if (/rate limit/i.test(m)) return "Trop de tentatives, réessaie dans quelques minutes.";
    return m;
  }

  /* ------------------------------------------------------------------ */
  /*  Implémentation DÉMO (données locales d'exemple)                    */
  /* ------------------------------------------------------------------ */
  function demoStore() {
    let listeners = [];
    let db = null;
    let currentUser = null;

    const save = () => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) {} };
    const persist = () => { try { sessionStorage.setItem(DEMO_KEY + "-user", JSON.stringify(currentUser)); } catch (e) {} };
    const now = Date.now();
    const iso = (daysAgo) => new Date(now - daysAgo * 864e5).toISOString();

    function samplePlanningSvg(titre, couleur) {
      const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
      const cours = [
        ["Anatomie 3", "Physiologie 2", "Sémiologie", "Biochimie", "Anatomie 4"],
        ["Sémiologie", "Anatomie 3", "Biochimie", "Physiologie 2", "TD Anatomie"],
        ["—", "TP Physio", "Secourisme", "TD Biochimie", "—"],
      ];
      const heures = ["08:30", "10:30", "14:30"];
      let cells = "";
      jours.forEach((j, i) => {
        cells += `<text x="${150 + i * 150}" y="95" font-size="16" font-weight="700" fill="#0f172a" text-anchor="middle">${j}</text>`;
      });
      heures.forEach((h, r) => {
        const y = 120 + r * 90;
        cells += `<text x="45" y="${y + 50}" font-size="15" fill="#475569" text-anchor="middle">${h}</text>`;
        jours.forEach((_, i) => {
          const c = cours[r][i];
          const fill = c === "—" ? "#f1f5f9" : couleur + "22";
          cells += `<rect x="${80 + i * 150}" y="${y}" width="140" height="80" rx="10" fill="${fill}" stroke="${couleur}55"/>`;
          cells += `<text x="${150 + i * 150}" y="${y + 46}" font-size="15" fill="#0f172a" text-anchor="middle">${c}</text>`;
        });
      });
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="420" viewBox="0 0 840 420"><rect width="840" height="420" fill="#fff"/><rect width="840" height="56" fill="${couleur}"/><text x="24" y="36" font-size="22" font-weight="700" fill="#fff" font-family="Arial">${titre}</text><g font-family="Arial">${cells}</g></svg>`;
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

    function seed() {
      return {
        seq: 100,
        news: [
          { id: 1, titre: "Bienvenue sur la plateforme MedFMPC 🎉", categorie: "Info", epingle: true,
            contenu: "Retrouvez ici les cours classés par année, les plannings mis à jour et toutes les annonces importantes de la faculté.\n\nLes éditeurs de chaque promo peuvent publier directement depuis l'Espace admin.",
            auteur_nom: "Admin", created_at: iso(0.2) },
          { id: 2, titre: "Examens du 1er semestre — calendrier publié", categorie: "Examen", epingle: false,
            contenu: "Le calendrier des examens de S1 (1ère et 2ème année) est disponible dans la rubrique Planning.\nPensez à vérifier vos salles la veille.",
            auteur_nom: "Délégué 2A", created_at: iso(1.5) },
          { id: 3, titre: "Les cours du S3 sont en ligne", categorie: "Cours", epingle: false,
            contenu: "Anatomie 3 + 4, Physiologie 2, Sémiologie 1, Biochimie clinique… tout est dans Leçons > Médecine > 2ème année > S3.",
            auteur_nom: "Délégué 2A", created_at: iso(3) },
          { id: 4, titre: "Journée de don du sang — jeudi au hall principal", categorie: "Événement", epingle: false,
            contenu: "Venez nombreux ! Inscription sur place de 9h à 15h.",
            auteur_nom: "BDE", created_at: iso(6) },
        ],
        plannings: [
          { id: 11, titre: "Emploi du temps — Semaine 8", filiere: "medecine", annee: 2, periode: "S3",
            type: "image", fichier_url: samplePlanningSvg("Médecine 2ème année (S3) — Semaine 8", "#0f766e"), auteur_nom: "Délégué 2A", created_at: iso(0.5) },
          { id: 12, titre: "Emploi du temps — Semaine 8", filiere: "medecine", annee: 1, periode: "S1",
            type: "image", fichier_url: samplePlanningSvg("Médecine 1ère année (S1) — Semaine 8", "#0369a1"), auteur_nom: "Délégué 1A", created_at: iso(1) },
          { id: 13, titre: "Planning des TP", filiere: "pharmacie", annee: 1, periode: "Semestre 1",
            type: "image", fichier_url: samplePlanningSvg("Pharmacie 1ère année — TP", "#7c3aed"), auteur_nom: "Délégué Pharma", created_at: iso(2) },
        ],
        lessons: [
          { id: 21, filiere: "medecine", annee: 2, semestre: "S3", module: "Anatomie 3 + 4", titre: "Fiche — Voies de la sensibilité",
            description: "Synthèse faite par la promo (exemple).", lien: "https://drive.google.com/", auteur_nom: "Délégué 2A", created_at: iso(1) },
          { id: 22, filiere: "medecine", annee: 2, semestre: "S3", module: "Sémiologie 1", titre: "QCM corrigés — Sémiologie cardiaque",
            description: "", lien: "https://drive.google.com/", auteur_nom: "Délégué 2A", created_at: iso(2) },
        ],
        acces: [
          { user_id: "u5", filiere: "medecine", annee: 1, jusqu: "2027-09-30", source: "en_ligne" },
        ],
        demandes: [
          { id: 91, user_id: "u4", filiere: "medecine", annee: 2, mode: "cashplus", preuve: "demo.jpg", statut: "en_attente", created_at: iso(0.4) },
        ],
        members: [
          { id: "u1", email: "admin@exemple.com", nom: "Admin MedFMPC", role: "admin", actif: true, created_at: iso(30), last_seen: iso(0.1) },
          { id: "u2", email: "delegue1a@exemple.com", nom: "Délégué 1A", role: "editor", actif: true, created_at: iso(20), last_seen: iso(1) },
          { id: "u3", email: "sara.alaoui-etu@etu.univh2c.ma", nom: "Sara Alaoui", role: "user", actif: true, created_at: iso(5), last_seen: iso(3), filiere_choisie: "medecine", annee_choisie: 2 },
          { id: "u4", email: "karim.b@gmail.com", nom: "Karim Bennani", role: "user", actif: true, created_at: iso(2), last_seen: iso(0.5) },
          { id: "u5", email: "lina.r@hotmail.com", nom: "Lina Rami", role: "user", actif: true, created_at: iso(40), last_seen: iso(1) },
        ],
      };
    }

    return {
      demo: true,
      async init() {
        try { db = JSON.parse(localStorage.getItem(DEMO_KEY) || "null"); } catch (e) { db = null; }
        if (!db || !db.news) { db = seed(); save(); }
        try { currentUser = JSON.parse(sessionStorage.getItem(DEMO_KEY + "-user") || "null"); } catch (e) {}
      },
      user: () => currentUser,
      onAuth(fn) { listeners.push(fn); },
      onRecovery() {},
      async refreshUser() { return currentUser; },
      async resetPassword() {},
      async updatePassword() {},
      async pingVisite() {},
      async statsVisites() { return { total: 128, jour: 7, semaine: 34 }; },
      async setActif(id, actif) { const m = db.members.find((x) => x.id === id); if (m) m.actif = actif; save(); },
      async loadSnapshot() {},
      async publicStats() { return null; },
      async importSnapshot(json) { const f = {}; json.semestres.forEach((x) => Object.assign(f, x.dossiers)); window.Drive.setSnapshot(f, new Date().toISOString().slice(0, 10)); },
      async choisirAnnee(filiere, annee) {
        if (!currentUser.univ) throw new Error("Le choix gratuit est réservé aux emails @" + domaineGratuit());
        currentUser.choix = { filiere, annee: Number(annee) }; currentUser.acces = true; persist();
        const m = db.members.find((x) => x.email === currentUser.email); if (m) { m.filiere_choisie = filiere; m.annee_choisie = Number(annee); save(); }
      },
      async demanderAcces(filiere, annee, mode) {
        const d = { id: ++db.seq, user_id: currentUser.id, filiere, annee: Number(annee), mode, preuve: "demo.jpg", statut: "en_attente", created_at: new Date().toISOString() };
        db.demandes.push(d); save();
        currentUser.demandes = [...(currentUser.demandes || []), d]; persist();
        listeners.forEach((f) => f(currentUser));
      },
      async preuveUrl() { return "#"; },
      async payToken(filiere, annee) { return { token: "demo", montant: CFG.tarif && CFG.tarif.montant, sandbox: true, filiere, annee }; },
      async demoPayer(filiere, annee) {
        currentUser.annees = [...(currentUser.annees || []), { filiere, annee: Number(annee), jusqu: finAnneeUniv() }];
        currentUser.acces = true; persist();
      },
      async validerDemande(id) {
        const d = db.demandes.find((x) => x.id === id); if (!d) return;
        d.statut = "validee";
        db.acces = db.acces.filter((x) => !(x.user_id === d.user_id && x.filiere === d.filiere && x.annee === d.annee));
        db.acces.push({ user_id: d.user_id, filiere: d.filiere, annee: d.annee, jusqu: finAnneeUniv(), source: d.mode }); save();
      },
      async refuserDemande(id) { const d = db.demandes.find((x) => x.id === id); if (d) d.statut = "refusee"; save(); },
      async donnerAcces(uid, filiere, annee) {
        db.acces = db.acces.filter((x) => !(x.user_id === uid && x.filiere === filiere && x.annee === Number(annee)));
        db.acces.push({ user_id: uid, filiere, annee: Number(annee), jusqu: finAnneeUniv(), source: "admin" }); save();
      },
      async retirerAcces(uid, filiere, annee) { db.acces = db.acces.filter((x) => !(x.user_id === uid && x.filiere === filiere && x.annee === Number(annee))); save(); },
      async signIn(email) {
        // Aperçu : « admin… » = admin ; @etu.univh2c.ma = étudiant gratuit ; autre email = accès payant
        const role = /^admin/i.test(email) ? "admin" : "user";
        currentUser = { id: role === "admin" ? "u1" : "u9", email, nom: email.split("@")[0] || "Admin", role, actif: true, ...accesInfo(email, role, [], [], null) };
        try { sessionStorage.setItem(DEMO_KEY + "-user", JSON.stringify(currentUser)); } catch (e) {}
        listeners.forEach((f) => f(currentUser));
        return currentUser;
      },
      async signUp(email, pw, nom) {
        const role = /^admin/i.test(email) ? "admin" : "user";
        currentUser = { id: role === "admin" ? "u1" : "u9", email, nom: nom || email.split("@")[0], role, actif: true, ...accesInfo(email, role, [], [], null) };
        try { sessionStorage.setItem(DEMO_KEY + "-user", JSON.stringify(currentUser)); } catch (e) {}
        listeners.forEach((f) => f(currentUser));
        return { confirm: false };
      },
      async signOut() {
        currentUser = null;
        try { sessionStorage.removeItem(DEMO_KEY + "-user"); } catch (e) {}
        listeners.forEach((f) => f(null));
      },
      async list(table, filters = {}) {
        return (db[table] || [])
          .filter((r) => Object.entries(filters).every(([k, v]) => v === undefined || v === null || v === "" || String(r[k]) === String(v)))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
      },
      async insert(table, row) {
        const r = { ...row, id: ++db.seq, created_at: new Date().toISOString(), auteur_nom: currentUser ? currentUser.nom : null };
        db[table].push(r); save(); return r;
      },
      async update(table, id, patch) {
        const r = db[table].find((x) => x.id === id); Object.assign(r, patch); save(); return r;
      },
      async remove(table, row) { db[table] = db[table].filter((x) => x.id !== row.id); save(); },
      async upload(file) {
        // En démo, on garde le fichier en mémoire (data URL) s'il est petit
        const url = await new Promise((res) => {
          if (file.size > 1.5e6) return res(URL.createObjectURL(file));
          const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file);
        });
        return { url, path: null };
      },
      async removeFile() {},
      async members() {
        return db.members.map((m) => ({
          ...m,
          acces_list: db.acces.filter((x) => x.user_id === m.id),
          demandes_list: db.demandes.filter((x) => x.user_id === m.id && x.statut === "en_attente"),
        }));
      },
      async setRole(id, role) { const m = db.members.find((x) => x.id === id); if (m) m.role = role; save(); },
      // Notes (aperçu : gardées dans ce navigateur)
      async getNote(fichier) { return (db.notes || []).find((n) => n.user_id === currentUser.id && n.fichier === fichier) || null; },
      async saveNote(fichier, { contenu, nom, contexte }) {
        db.notes = (db.notes || []).filter((n) => !(n.user_id === currentUser.id && n.fichier === fichier));
        if (contenu.trim()) db.notes.push({ user_id: currentUser.id, fichier, nom, contexte, contenu, updated_at: new Date().toISOString() });
        save();
      },
      async listNotes() { return (db.notes || []).filter((n) => n.user_id === currentUser.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); },
      async deleteNote(fichier) { db.notes = (db.notes || []).filter((n) => !(n.user_id === currentUser.id && n.fichier === fichier)); save(); },
      reset() { db = seed(); save(); },
    };
  }

  /* ------------------------------------------------------------------ */
  /*  GOOGLE DRIVE                                                       */
  /*  - avec clé API : lecture en direct du Drive                        */
  /*  - sans clé : copie de l'arborescence (js/drive-data.js)            */
  /* ------------------------------------------------------------------ */
  const FOLDER = "application/vnd.google-apps.folder";
  const SHORTCUT = "application/vnd.google-apps.shortcut";
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  const cache = new Map();
  // Copie de l'arborescence : chargée depuis Supabase après connexion
  // (ou depuis js/drive-data.js dans l'aperçu hors ligne)
  const SNAP = {};
  const snapIndex = new Map(); // id -> { name, parent, folder }
  let snapUpdated = "";
  function setSnapshot(folders, updated) {
    Object.keys(SNAP).forEach((k) => delete SNAP[k]);
    snapIndex.clear(); cache.clear();
    Object.assign(SNAP, folders || {});
    Object.entries(SNAP).forEach(([parent, items]) => items.forEach(([id, name, f]) => snapIndex.set(id, { name, parent, folder: !!f })));
    snapUpdated = updated || snapUpdated;
  }
  if (window.DRIVE_SNAPSHOT) setSnapshot(window.DRIVE_SNAPSHOT.folders, window.DRIVE_SNAPSHOT.updated);

  const EXT_MIME = {
    pdf: "application/pdf", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic",
    mp4: "video/mp4", mov: "video/quicktime", m4a: "audio/mp4", mp3: "audio/mpeg",
  };
  function guessMime(name) {
    const m = /\.([a-z0-9]{2,5})$/i.exec(name || "");
    return m ? (EXT_MIME[m[1].toLowerCase()] || "application/octet-stream") : "application/vnd.google-apps.document";
  }
  function sortItems(items) {
    return items.sort((a, b) => {
      const fa = a.mimeType === FOLDER, fb = b.mimeType === FOLDER;
      if (fa !== fb) return fa ? -1 : 1;
      return collator.compare(a.name, b.name);
    });
  }
  const fromSnap = (id) => sortItems((SNAP[id] || []).map(([fid, name, f]) => ({ id: fid, name, mimeType: f ? FOLDER : guessMime(name) })));

  const Drive = {
    FOLDER,
    live: () => !!CFG.googleApiKey,
    // true si on peut afficher ce dossier (en direct ou via la copie)
    canList: (id) => !!CFG.googleApiKey || Object.prototype.hasOwnProperty.call(SNAP, id),
    snapshotDate: () => snapUpdated,
    setSnapshot,
    rootItems: (id) => SNAP[id] || [],
    async list(folderId) {
      if (cache.has(folderId)) return cache.get(folderId);
      if (!CFG.googleApiKey) { const r = fromSnap(folderId); cache.set(folderId, r); return r; }
      const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,shortcutDetails)");
      let token = "", all = [];
      try {
        do {
          const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&key=${encodeURIComponent(CFG.googleApiKey)}${token ? "&pageToken=" + token : ""}`;
          const r = await fetch(url);
          const j = await r.json();
          if (!r.ok) throw new Error((j.error && j.error.message) || "Erreur Google Drive");
          all = all.concat(j.files || []);
          token = j.nextPageToken || "";
        } while (token);
      } catch (e) {
        if (SNAP[folderId]) { const r = fromSnap(folderId); cache.set(folderId, r); return r; } // repli sur la copie
        throw e;
      }
      all = all.map((f) => f.mimeType === SHORTCUT && f.shortcutDetails
        ? { ...f, id: f.shortcutDetails.targetId, mimeType: f.shortcutDetails.targetMimeType }
        : f);
      sortItems(all);
      all.forEach((it) => cache.set("name:" + it.id, it.name));
      cache.set(folderId, all);
      return all;
    },
    async name(id) {
      if (snapIndex.has(id)) return snapIndex.get(id).name;
      const k = "name:" + id;
      if (cache.has(k)) return cache.get(k);
      if (!CFG.googleApiKey) return "Dossier";
      try {
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true&key=${encodeURIComponent(CFG.googleApiKey)}`);
        const j = await r.json();
        cache.set(k, j.name || "Dossier");
      } catch (e) { cache.set(k, "Dossier"); }
      return cache.get(k);
    },
    // Nombre de fichiers (récursif) — uniquement avec la copie
    countFiles(id) {
      if (!SNAP[id]) return null;
      let n = 0;
      const walk = (fid) => (SNAP[fid] || []).forEach(([cid, , f]) => (f ? walk(cid) : n++));
      walk(id);
      return n;
    },
    // Recherche dans tout un semestre — uniquement avec la copie
    canSearch: (rootId) => !!SNAP[rootId],
    search(rootId, query) {
      const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const words = norm(query).split(/\s+/).filter(Boolean);
      const out = [];
      const walk = (fid, path) => (SNAP[fid] || []).forEach(([cid, name, f]) => {
        if (f) walk(cid, [...path, { id: cid, name }]);
        else if (words.every((w) => norm(name + " " + path.map((p) => p.name).join(" ")).includes(w))) {
          out.push({ id: cid, name, mimeType: guessMime(name), path });
        }
      });
      walk(rootId, []);
      return out.slice(0, 200);
    },
    viewUrl: (it) => it.webViewLink || (it.mimeType === FOLDER ? `https://drive.google.com/drive/folders/${it.id}` : `https://drive.google.com/file/d/${it.id}/view`),
    downloadUrl: (it) => (it.mimeType || "").startsWith("application/vnd.google-apps")
      ? Drive.viewUrl(it)
      : `https://drive.google.com/uc?export=download&id=${it.id}`,
    // Aperçu d'un fichier, affiché DANS le site
    previewUrl: (id) => `https://drive.google.com/file/d/${id}/preview`,
    info: (id) => snapIndex.get(id) || null,
    // Dossiers parents d'un fichier : { root: dossier du semestre, folders: [ids du haut vers le bas] }
    trail(id) {
      const chain = []; const cur = snapIndex.get(id);
      let pid = cur ? cur.parent : null;
      while (pid && snapIndex.has(pid)) { chain.unshift(pid); pid = snapIndex.get(pid).parent; }
      return { root: pid, folders: chain };
    },
    embedFolderUrl: (id) => `https://drive.google.com/embeddedfolderview?id=${id}#list`,
    folderUrl: (id) => `https://drive.google.com/drive/folders/${id}`,
  };

  const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  window.Store = configured ? supabaseStore() : demoStore();
  window.Drive = Drive;
})();
