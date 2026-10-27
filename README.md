# MedFMPC

Plateforme de révision pour les étudiants de la **Faculté de Médecine et de Pharmacie** : cours rangés semestre par semestre, plannings, actualités de la promo, notes personnelles et assistant IA.

**Site :** https://medwebsite.github.io/MedFMPC/

---

## Fonctionnalités

### Pour les étudiants
- **Leçons** organisées comme le Drive : filière → année → semestre → module.
- **Lecteur intégré** : les cours (PDF, images) s'ouvrent directement dans le site, sans passer par Google Drive.
- **Annotations** sur les cours : stylo, surligneur, zones de texte, gomme, annuler, zoom. Tout est enregistré et privé.
- **Mode plein écran** pour lire et annoter le cours.
- **Mes notes** : un bloc-notes par fichier, enregistré automatiquement et regroupé dans la page « Mes notes ».
- **Assistant IA** (Gemini) : questions de cours, résumés, QCM. Il peut lire le cours ouvert. 20 questions par jour.
- **Plannings** et **actualités** publiés par l'équipe.
- Interface en **français, arabe et anglais**, avec **mode clair / sombre**, sur ordinateur et téléphone.

### Accès
- **Inscription obligatoire.**
- **Gratuit** avec un email `@etu.univh2c.ma` : accès à l'année choisie, modifiable à tout moment depuis « Mon année ».
- **200 DH par année** pour les autres emails (paiement par carte, virement ou CashPlus). L'accès dure jusqu'au **30 septembre**.

### Rôles
| Rôle | Peut faire |
|---|---|
| **Étudiant** | Consulter les cours de son année, annoter, prendre des notes, utiliser l'assistant |
| **Éditeur** | + publier plannings et actualités |
| **Admin** | + gérer les membres, les rôles, les accès payants et la liaison Drive |

---

## Technique

- **Front-end** : HTML / CSS / JavaScript sans compilation, hébergé sur **GitHub Pages**.
- **Back-end** : **Supabase** (comptes, base de données avec règles de sécurité RLS, stockage, Edge Functions).
- **Lecteur PDF** : PDF.js.
- **IA** : API Gemini (offre gratuite de Google), appelée uniquement depuis le serveur.

```
index.html                  page unique du site
css/style.css               design (clair / sombre, mobile, arabe)
js/config.js                réglages du site : nom, tarif, Supabase, dossiers Drive
js/data.js                  accès aux données (Supabase)
js/app.js                   pages et navigation
js/annot.js                 lecteur PDF + stylo, surligneur, zones de texte
js/i18n.js, i18n-dict.js    traduction FR / AR / EN
supabase/*.sql              structure de la base et règles de sécurité
supabase/functions/         Edge Functions (fichier, assistant, paiement)
```

### Edge Functions Supabase
| Fonction | Rôle |
|---|---|
| `fichier` | Sert un cours du Drive au lecteur intégré, après vérification de l'accès de l'étudiant |
| `assistant` | Interroge Gemini en respectant la limite de questions par jour |
| `paiement-token` / `paiement-webhook` | Paiement par carte (YouCan Pay) |

Les clés secrètes (Gemini, YouCan Pay…) sont uniquement dans **Supabase → Edge Functions → Secrets**, jamais dans ce dépôt.

---

## Administration

- **Ajouter un éditeur** : la personne crée son compte, puis **Espace admin → Membres & rôles → Éditeur**.
- **Valider un paiement manuel** : **Espace admin → Membres & rôles → Activer**.
- **Mettre à jour la liste des cours** : **Espace admin → Liaison Drive → Importer** le fichier d'import (ce fichier ne doit pas être mis sur GitHub).
- **Modifier le site** : ouvrir le fichier sur GitHub → ✏️ → *Commit changes*. Le site se met à jour en environ une minute.

### Installation sur un nouveau projet Supabase
Dans **SQL Editor**, exécuter dans l'ordre : `schema.sql`, `maj-securite.sql`, `maj-acces-payant.sql`, `maj-notes.sql`, `maj-annotations.sql`, `maj-assistant.sql`. Puis déployer les Edge Functions et renseigner `supabaseUrl` et `supabaseAnonKey` dans `js/config.js`.
