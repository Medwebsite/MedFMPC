/* =====================================================================
   CONFIGURATION DU SITE — c'est le SEUL fichier à modifier.
   Tant que supabaseUrl est vide, le site fonctionne en « mode démo »
   (données d'exemple, rien n'est enregistré en ligne).
   ===================================================================== */
window.APP_CONFIG = {
  nomSite: "MedFMPC",
  faculte: "Faculté de Médecine et de Pharmacie",
  slogan: "Cours, plannings et actualités — au même endroit.",

  // Si true, il faut un compte pour voir et utiliser le site (pas d'accès visiteur).
  inscriptionObligatoire: true,

  // --- Accès gratuit / payant ----------------------------------------
  // Gratuit pour les emails de ce domaine, payant pour les autres.
  domaineGratuit: "etu.univh2c.ma",
  tarif: {
    montant: 200,               // prix en DH (0 = « prix à définir »)
    devise: "DH",
    periode: "l'année universitaire (jusqu'au 30 septembre)",
  },
  paiement: {
    // Paiement par carte intégré (YouCan Pay) : clé PUBLIQUE uniquement.
    // La clé privée ne va JAMAIS ici : elle va dans Supabase > Edge Functions > Secrets.
    youcanPay: { clePublique: "pub_sandbox_1d521a1b-c0f4-4338-8568-aa707" },
    // (Autre option) lien vers une page de paiement externe
    lienEnLigne: "",
    // Virement bancaire
    virement: { beneficiaire: "", banque: "", rib: "" },
    // CashPlus / Wafacash
    cashplus: { beneficiaire: "", telephone: "" },
    // Contact pour les questions (WhatsApp ou email)
    contact: "",
  },

  // --- Supabase (Project Settings > API) ---------------------------
  supabaseUrl: "https://tesfbohfkehzdgnpicrt.supabase.co",
  supabaseAnonKey: "sb_publishable_0eKl3Q1rza_ijURba2Ha3w_xQufzzjP",    // clé publique (publishable)

  // --- Google Drive ------------------------------------------------
  // Laisse vide : avec l'accès payant, la liste des cours est protégée
  // dans Supabase (importée depuis Espace admin > Liaison Drive).
  // Une clé API Google la rendrait lisible par tout le monde.
  googleApiKey: "",

  // Laisse vide : les cours passent par le serveur (Edge Function « fichier »).
  googleFichiersKey: "",

  // --- Filières, années & semestres --------------------------------
  // drive: "lié" = ce semestre a des cours (liste importée dans Espace admin >
  // Liaison Drive). Les liens Google Drive ne sont JAMAIS écrits ici ni envoyés
  // aux navigateurs : le serveur les garde secrets.
  filieres: [
    {
      id: "medecine",
      nom: "Médecine",
      couleur: "#0f766e",
      annees: [
        { annee: 1, label: "1ère année", semestres: [{ code: "S1", drive: "" }, { code: "S2", drive: "lié" }] },
        { annee: 2, label: "2ème année", semestres: [{ code: "S3", drive: "lié" }, { code: "S4", drive: "" }] },
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
