# MedFMPC — site étudiant (FMP Casablanca)

Site statique (HTML/CSS/JS, aucune compilation) hébergé **gratuitement sur GitHub Pages**, avec **Supabase** (gratuit) pour les comptes, les actualités, les plannings et les fichiers.

| Qui | Peut faire |
|---|---|
| **Visiteur** (sans compte) | Voir et télécharger les leçons, plannings et actualités |
| **Éditeur** | Ajouter / supprimer leçons, plannings (PDF ou image) et actualités |
| **Admin principal** (toi) | Tout ça + nommer ou retirer les éditeurs |

Le Drive reste en **lecture seule** : le site affiche son contenu, personne ne peut le modifier depuis le site.

```
index.html          ← la page
css/style.css       ← le design
js/config.js        ← ⚙️ LE SEUL FICHIER À MODIFIER (clés + dossiers Drive)
js/data.js          ← connexion Supabase / Google Drive
js/app.js           ← les pages
supabase/schema.sql ← à exécuter une fois dans Supabase
```

> Tant que `config.js` n'a pas de clés Supabase, le site tourne en **mode démo** (données d'exemple) : tu peux déjà tout tester en ouvrant `index.html`.

---

## Étape 1 — Créer la base Supabase (5 min)

1. Va sur **supabase.com** → *Start your project* → connecte-toi avec GitHub.
2. *New project* → nom `medfmpc`, choisis un mot de passe, région **Europe (Frankfurt / Paris)** → *Create*.
3. Menu de gauche **SQL Editor** → *New query* → colle tout le contenu de `supabase/schema.sql` → **Run**.
4. **Project Settings → API** : copie
   - *Project URL* → dans `config.js`, champ `supabaseUrl`
   - *anon public key* → champ `supabaseAnonKey`
   (Cette clé est faite pour être publique : la sécurité est assurée par les règles du fichier SQL.)

## Étape 2 — Lier le Drive

Le site est organisé **filière → année → semestre (S1…S12) → modules**, exactement comme le Drive.

1. Dans Google Drive, clic droit sur le dossier du semestre → **Partager** → Accès général : **« Tous les utilisateurs disposant du lien » — Lecteur**.
2. Copie l'ID dans l'URL : `https://drive.google.com/drive/folders/`**`1AbCdEf...`** → colle-le dans `config.js`, champ `drive` du bon semestre.
   *(Déjà fait : Médecine 2ème année — S3.)*
3. **Deux façons d'afficher le Drive :**
   - **Sans clé (par défaut)** : le site utilise une copie de l'arborescence enregistrée dans `js/drive-data.js` (recherche dans tout le semestre, nombre de fichiers par module). Quand le Drive change beaucoup, demande à Claude de rafraîchir ce fichier.
   - **Avec une clé API Google (recommandé à terme)** : le site lit le Drive **en direct**, plus besoin de rafraîchir.
     1. **console.cloud.google.com** → crée un projet.
     2. *APIs & Services → Library* → **Google Drive API** → *Enable*.
     3. *Credentials → Create credentials → API key*.
     4. *Edit API key* → **Websites** : `https://TONPSEUDO.github.io/*` ; **API restrictions** : Google Drive API → *Save*.
     5. Colle la clé dans `config.js` → `googleApiKey`.

## Étape 3 — Mettre en ligne sur GitHub Pages (gratuit)

1. Sur **github.com** → *New repository* → nom `medfmpc` → **Public** → *Create*.
2. *uploading an existing file* → glisse **tout le contenu** du dossier (index.html, css, js, supabase, .nojekyll, README.md) → *Commit changes*.
3. **Settings → Pages** → *Source : Deploy from a branch* → Branch **main** / **(root)** → *Save*.
4. Après 1–2 min ton site est en ligne : **`https://TONPSEUDO.github.io/medfmpc/`**
5. Retourne dans Supabase → **Authentication → URL Configuration** → *Site URL* = cette adresse (pour que les emails de confirmation renvoient vers ton site).

Pour modifier le site plus tard : sur GitHub, ouvre le fichier (ex. `js/config.js`) → icône ✏️ → *Commit*. Le site se met à jour en ~1 min.

## Étape 4 — Devenir admin principal

1. Sur ton site : **Connexion → Créer un compte** (confirme l'email reçu).
2. Supabase → **SQL Editor** → exécute (avec ton email) :
   ```sql
   update public.profiles set role = 'admin' where email = 'ton.email@exemple.com';
   ```
3. Reconnecte-toi : le menu **Espace admin** apparaît.

## Étape 5 — Ajouter des éditeurs

1. La personne crée son compte sur le site (*Connexion → Créer un compte*).
2. Toi : **Espace admin → Membres & rôles** → passe-la en **Éditeur**.
3. Elle peut maintenant publier plannings, actualités et leçons. Tu peux lui retirer le rôle à tout moment.

---

### Limites de l'offre gratuite Supabase
- 1 Go de fichiers, 50 Mo max par fichier → largement suffisant pour des plannings et quelques ajouts (les gros cours restent sur le Drive).
- Un projet **inactif pendant 7 jours** est mis en pause : il suffit de le relancer d'un clic dans le tableau de bord Supabase. Dès que des étudiants utilisent le site, ça n'arrive pas.

### Personnaliser
- Nom du site, faculté, couleurs, nombre d'années : tout est dans `js/config.js`.
- Catégories d'actualités : constante `CATEGORIES` en haut de `js/app.js`.
