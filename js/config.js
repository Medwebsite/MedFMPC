/* =====================================================================
   CONFIGURATION DU SITE — c'est le SEUL fichier à modifier.
   Tant que supabaseUrl est vide, le site fonctionne en « mode démo »
   (données d'exemple, rien n'est enregistré en ligne).
   ===================================================================== */
window.APP_CONFIG = {
  nomSite: "MedFMPC",
  faculte: "Faculté de Médecine et de Pharmacie de Casablanca",
  slogan: "Cours, plannings et actualités — au même endroit.",

  // --- Supabase (Project Settings > API) ---------------------------
  supabaseUrl: "https://tesfbohfkehzdgnpicrt.supabase.co",
  supabaseAnonKey: "sb_publishable_0eKl3Q1rza_ijURba2Ha3w_xQufzzjP",    // clé publique (publishable)

  // --- Google Drive ------------------------------------------------
  // Clé API Google (Drive API activée) = le site lit le Drive EN DIRECT.
  // Sans clé, le site utilise la copie du Drive enregistrée dans
  // js/drive-data.js (à rafraîchir quand le Drive change).
  googleApiKey: "",

  // --- Filières, années & semestres --------------------------------
  // Pour chaque semestre, colle l'ID du dossier Drive correspondant.
  // L'ID est la partie après /folders/ dans le lien :
  //   https://drive.google.com/drive/folders/1AbCdEfGh...  ->  "1AbCdEfGh..."
  filieres: [
    {
      id: "medecine",
      nom: "Médecine",
      couleur: "#0f766e",
      annees: [
        { annee: 1, label: "1ère année", semestres: [{ code: "S1", drive: "" }, { code: "S2", drive: "1LPGgwmpWjnTPD4VnP11qT0keVhhrDKSV" }] },
        { annee: 2, label: "2ème année", semestres: [{ code: "S3", drive: "1BvZgD_dF4oIrIkeYpAh5lmmX6KXtezIp" }, { code: "S4", drive: "" }] },
        { annee: 3, label: "3ème année", semestres: [{ code: "S5", drive: "" }, { code: "S6", drive: "" }] },
        { annee: 4, label: "4ème année", semestres: [{ code: "S7", drive: "" }, { code: "S8", drive: "" }] },
        { annee: 5, label: "5ème année", semestres: [{ code: "S9", drive: "" }, { code: "S10", drive: "" }] },
        { annee: 6, label: "6ème année", semestres: [{ code: "S11", drive: "" }, { code: "S12", drive: "" }] },
      ],
    },
    {
      id: "pharmacie",
      nom: "Pharmacie",
      couleur: "#7c3aed",
      annees: [
        { annee: 1, label: "1ère année", semestres: [{ code: "S1", drive: "" }, { code: "S2", drive: "" }] },
        { annee: 2, label: "2ème année", semestres: [{ code: "S3", drive: "" }, { code: "S4", drive: "" }] },
        { annee: 3, label: "3ème année", semestres: [{ code: "S5", drive: "" }, { code: "S6", drive: "" }] },
        { annee: 4, label: "4ème année", semestres: [{ code: "S7", drive: "" }, { code: "S8", drive: "" }] },
        { annee: 5, label: "5ème année", semestres: [{ code: "S9", drive: "" }, { code: "S10", drive: "" }] },
        { annee: 6, label: "6ème année", semestres: [{ code: "S11", drive: "" }, { code: "S12", drive: "" }] },
      ],
    },
  ],
};
