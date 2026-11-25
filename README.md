# Orea · Retrouve tes pièces perdues à Abidjan

**Orea** met en relation ceux qui **trouvent** une pièce d'identité et ceux qui l'ont **perdue**, via des points relais répartis dans les communes d'Abidjan.

- **J'ai trouvé** : je photographie la pièce. L'application la lit (OCR), remplit le formulaire, floute les données sensibles, et je choisis un point relais sur la carte.
- **J'ai perdu** : je déclare ma perte. Dès qu'une pièce correspondante est signalée, je suis prévenu, même si mon nom est mal orthographié ou mes prénoms inversés.
- **Je récupère** : je prouve que la pièce est à moi avec son numéro, je reçois un **QR code unique**, et le point relais le scanne pour valider la restitution.

CNI, passeport, permis de conduire, carte d'étudiant, carte grise et attestation d'identité sont acceptés.

> Projet de classe. Toutes les données de démonstration (noms, numéros, pièces « SPÉCIMEN ») sont **fictives**.

---

## Sommaire

1. [Captures](#captures)
2. [Lancement en une commande](#lancement-en-une-commande)
3. [Comptes de test](#comptes-de-test)
4. [Fonctionnalités](#fonctionnalités)
5. [Sécurité et confidentialité](#sécurité-et-confidentialité)
6. [Architecture](#architecture)
7. [Développement local sans Docker](#développement-local-sans-docker)
8. [Tests](#tests)
9. [Configuration](#configuration)

---

## Captures

Un aperçu de l'application sans avoir à la lancer. Les captures sont faites avec les données de démonstration (fictives), et toutes les images sont dans [`docs/captures/`](docs/captures/).

### Accueil

![Page d'accueil](docs/captures/01-accueil.png)

<table>
  <tr>
    <td width="50%"><img src="docs/captures/06-accueil-sombre.png" alt="Accueil en mode sombre"><br><sub><b>Mode sombre</b> : suit la préférence du système, ou se bascule avec le bouton lune/soleil.</sub></td>
    <td width="50%" align="center"><img src="docs/captures/07-accueil-mobile.png" alt="Accueil sur mobile" width="260"><br><sub><b>Mobile</b> : barre de navigation en bas de l'écran.</sub></td>
  </tr>
</table>

<details>
<summary>Voir la page d'accueil en entier (étapes, sécurité, carte des points relais, compteurs)</summary>

![Page d'accueil complète](docs/captures/02-accueil-complet.png)

</details>

### Recherche, connexion, inscription

<table>
  <tr>
    <td width="33%"><img src="docs/captures/03-recherche.png" alt="Recherche"><br><sub><b>Recherche</b> par nom : seules les initiales et la commune sont affichées</sub></td>
    <td width="33%"><img src="docs/captures/04-connexion.png" alt="Connexion"><br><sub><b>Connexion</b>, avec les comptes de démo en un clic</sub></td>
    <td width="33%"><img src="docs/captures/05-inscription.png" alt="Inscription"><br><sub><b>Inscription</b></sub></td>
  </tr>
</table>

### Déclarer une pièce

<table>
  <tr>
    <td width="50%"><img src="docs/captures/12-declarer-trouve.png" alt="J'ai trouvé une pièce"><br><sub><b>J'ai trouvé</b> : photo de la pièce, lecture automatique (OCR) puis choix du point relais. Des spécimens permettent d'essayer.</sub></td>
    <td width="50%"><img src="docs/captures/11-declarer-perdu.png" alt="J'ai perdu une pièce"><br><sub><b>J'ai perdu</b> : déclaration de perte, avec alerte dès qu'une pièce correspondante est signalée.</sub></td>
  </tr>
</table>

### Espace utilisateur (compte `aya@orea.ci`)

![Tableau de bord : mes pertes](docs/captures/10-tableau-de-bord-1-mes-pertes.png)

<sub>Une correspondance trouvée, avec le score et les raisons du rapprochement.</sub>

<table>
  <tr>
    <td width="50%"><img src="docs/captures/10-tableau-de-bord-2-mes-trouvailles.png" alt="Mes trouvailles"><br><sub><b>Mes trouvailles</b></sub></td>
    <td width="50%"><img src="docs/captures/10-tableau-de-bord-3-mes-qr-codes.png" alt="Mes QR codes"><br><sub><b>Mes QR codes</b> de retrait</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/captures/10-tableau-de-bord-4-notifications.png" alt="Notifications"><br><sub><b>Notifications</b></sub></td>
    <td width="50%"><img src="docs/captures/10-tableau-de-bord-5-profil.png" alt="Profil"><br><sub><b>Profil</b></sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/captures/13-reclamer.png" alt="Réclamer une pièce"><br><sub><b>Réclamer</b> : le numéro saisi est comparé à une empreinte chiffrée avant de délivrer le QR code.</sub></td>
    <td width="50%"></td>
  </tr>
</table>

### Espace point relais (compte `relais.cocody@orea.ci`)

![Espace point relais](docs/captures/20-espace-relais.png)

<sub>Pièces à réceptionner, stock, et scan du QR code présenté par le propriétaire (ou code de secours).</sub>

### Administration (compte `admin@orea.ci`)

![Administration : centre de contrôle](docs/captures/30-admin-1-vue-densemble.png)

<sub>Centre de contrôle : taux de réussite, carte thermique d'Abidjan, activité en direct, entonnoir du signalement à la restitution, statistiques par commune et par type de pièce.</sub>

<table>
  <tr>
    <td width="50%"><img src="docs/captures/30-admin-2-points-relais.png" alt="Gestion des points relais"><br><sub><b>Points relais</b> : ajout, modification, activation</sub></td>
    <td width="50%"><img src="docs/captures/30-admin-3-utilisateurs.png" alt="Gestion des utilisateurs"><br><sub><b>Utilisateurs</b></sub></td>
  </tr>
</table>

<details>
<summary>Voir la modération et le journal d'audit</summary>

**Modération** des déclarations

![Modération](docs/captures/30-admin-4-moderation.png)

**Journal** d'audit

![Journal](docs/captures/30-admin-5-journal.png)

</details>

---

## Lancement en local (sans Docker)

C'est le mode utilisé pour la démo. Aucune base à installer : les données sont dans un fichier SQLite (`backend/orea.db`), et les e-mails sont enregistrés en HTML dans `backend/outbox/` (à ouvrir dans le navigateur). Ces réglages sont dans `backend/.env`.

**Prérequis :** Python 3.12+ et Node.js 20+.

```bash
# 1re fois seulement : installation
cd backend
python -m venv .venv
.venv\Scripts\pip install -e ".[dev,ocr]"           # macOS/Linux : .venv/bin/pip
.venv\Scripts\alembic upgrade head
.venv\Scripts\python -m scripts.seed --reset
cd ../frontend
npm install
```

Puis, à chaque lancement, deux terminaux :

```bash
# Terminal 1 : l'API (http://127.0.0.1:8000/docs)
cd backend
.venv\Scripts\python -m uvicorn app.main:app --port 8000

# Terminal 2 : le site (http://localhost:3000)
cd frontend
npm run dev
```

Pour remettre la démo à zéro : `cd backend` puis `.venv\Scripts\python -m scripts.seed --reset`.

---

## Lancement en une commande (Docker)

Variante avec PostgreSQL et la boîte e-mail Mailpit, tout dans Docker.

**Prérequis :** [Docker Desktop](https://www.docker.com/products/docker-desktop/) démarré.

```bash
docker compose up --build
```

Le premier lancement prend quelques minutes : il télécharge PyTorch et les modèles OCR, puis construit le frontend. Ensuite :

| Service | Adresse |
|---|---|
| **Application** | http://localhost:3000 |
| API + documentation Swagger | http://localhost:8000/docs |
| Boîte e-mail de démo (Mailpit) | http://localhost:8025 |

Au premier démarrage, l'API applique les migrations puis charge les **données de démonstration** : comptes de test, 6 points relais et 30 jours d'historique.

```bash
# Repartir d'une base de démo toute neuve
docker compose exec api python -m scripts.seed --reset

# Tout arrêter (ajouter -v pour effacer aussi la base)
docker compose down
```

> **Port 5433 :** la base Docker est exposée sur le port 5433 pour ne pas entrer en conflit avec un PostgreSQL déjà installé sur la machine. Modifiable avec `DB_PORT` dans `.env`.

---

## Comptes de test

Mot de passe commun : **`Orea2026!`**. Sur la page de connexion, l'encart « Comptes de démonstration » remplit le formulaire en un clic.

| Rôle | E-mail | Situation |
|---|---|---|
| Utilisatrice | `aya@orea.ci` | A perdu sa **CNI** (Aya Marie Kouassi) : en attente |
| Utilisateur | `koffi@orea.ci` | Celui qui va trouver la pièce pendant la démo |
| Utilisateur | `fabrice@orea.ci` | A perdu son **permis** (correspond au spécimen permis) |
| Utilisatrice | `awa@orea.ci` | A perdu son **passeport** (correspond au spécimen passeport) |
| Agent point relais | `relais.cocody@orea.ci` | Relais Orea · Cocody Deux-Plateaux |
| Agents point relais | `relais.plateau@`, `relais.yopougon@`, `relais.abobo@`, `relais.marcory@`, `relais.treichville@orea.ci` | Un agent par point relais |
| Administrateur | `admin@orea.ci` | Statistiques, gestion, modération |

**Pièces de test pour l'OCR :** trois fausses pièces marquées « SPÉCIMEN » sont dans [`backend/specimens/`](backend/specimens/). Elles sont aussi proposées en un clic dans le parcours « J'ai trouvé ». Leurs numéros : CNI `CI 0099 1234 56`, permis `AB 4521 7788`, passeport `20AB12345`.

Le déroulé complet de la démo de 3 minutes est dans [SCENARIO_DEMO.md](SCENARIO_DEMO.md).

---

## Fonctionnalités

**Utilisateur**
- Inscription, connexion, profil, avec un e-mail de bienvenue.
- Déclarer une pièce trouvée : photo depuis le téléphone ou import, **OCR qui pré-remplit** le formulaire (les champs incertains sont signalés « À vérifier »), choix du point relais sur la **carte**.
- Déclarer une perte, avec correspondance automatique dans les deux sens.
- Recherche publique : seuls le type de pièce, les **initiales** et la commune sont affichés.
- Réclamer une pièce : vérification par le numéro, puis **QR code** de retrait, avec un code de secours à saisir si la caméra échoue.
- Tableau de bord : pertes et correspondances, trouvailles, QR codes, notifications, profil.

**Point relais**
- Pièces attendues et en stock, confirmation de réception.
- **Scanner de QR code par la caméra du navigateur**, aperçu de la personne qui réclame, puis validation de la remise.
- Photo floutée de la pièce, pour reconnaître le document physique.

**Administrateur**
- Indicateurs et graphiques : pièces trouvées et restituées, taux de réussite, communes les plus concernées, types de pièces, délai moyen de retour.
- Gestion des points relais et des utilisateurs (rôles, activation, rattachement à un relais).
- Modération des déclarations et **journal d'audit**.

**Innovations**
- **Alerte en direct, en plein écran** : quand une pièce correspondant à ta perte est déclarée, ton écran s'illumine tout seul en quelques secondes (confettis, Ori qui saute, bouton « Récupérer ma pièce »).
- **« Pourquoi c'est ta pièce ? »** : une jauge de confiance animée et des raisons lisibles (prénoms inversés détectés, même date de naissance, même commune…). L'IA explique sa décision sans jamais révéler de donnée.
- **Avis de recherche à partager sur WhatsApp** : Orea génère une affiche avec QR code (initiales seulement). Celui qui trouve la pièce scanne et la déclare en une minute.
- **Centre de contrôle admin** : carte thermique d'Abidjan en mode nuit, flux d'activité en direct, anneau de réussite, entonnoir « signalée → restituée », indicateurs avec mini-courbes.
- **Fil « en direct » sur l'accueil** : les derniers événements réels, totalement anonymes.
- **Application installable** (PWA) : icône Orea sur l'écran d'accueil du téléphone, avec raccourcis « J'ai trouvé » et « J'ai perdu ».

**Expérience**
- Mascotte **Ori**, dérivée de l'épingle du logo, avec six humeurs : accueil, recherche, lecture, vide, erreur, fête.
- Confettis aux couleurs de la charte quand une correspondance est trouvée ou une pièce restituée.
- Mode sombre complet, mise en page du téléphone à l'ordinateur, navigation au clavier, respect de « réduire les animations ».

---

## Sécurité et confidentialité

| Risque | Protection |
|---|---|
| Fuite des numéros de pièce | Jamais stockés en clair : seule une empreinte **HMAC-SHA256 avec une clé secrète** est conservée. La vérification compare deux empreintes, en temps constant. |
| Photos de pièces | Décodées **en mémoire**. Les zones sensibles (nom, dates, numéro, MRZ, visage) sont **floutées de façon irréversible** et les métadonnées (EXIF, GPS) supprimées. L'original n'est jamais écrit dans le stockage. La version floutée n'est visible que par la personne qui a trouvé la pièce, le point relais et l'admin. |
| Faux QR code | Le jeton est dérivé par HMAC d'une clé secrète, et seule son empreinte SHA-256 est en base. Le QR est **unique**, à **usage unique**, valable **14 jours**, et ne fonctionne qu'au bon point relais. |
| Essais de numéros au hasard | **5 échecs, puis 24 h de blocage** et une alerte à l'admin. Limitation du nombre de requêtes sur la recherche, la vérification, la connexion et le scan. |
| Vol de session | Jeton d'accès de 15 min gardé en mémoire. Jeton de rafraîchissement en **cookie httpOnly**, renouvelé à chaque usage ; s'il est réutilisé, toutes les sessions sont fermées. |
| Mots de passe | Hachés avec **bcrypt**. Message identique pour un e-mail inconnu ou un mauvais mot de passe. |
| Recherche publique | Seuls le type de pièce, les initiales et la commune sont renvoyés. |

---

## Architecture

```
orea/
├── docker-compose.yml        # db · mailpit · api · web
├── .env.example              # toutes les variables, documentées
├── backend/                  # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── api/routes/       # couche HTTP : validation, rôles, codes de statut
│   │   ├── services/         # règles métier (correspondance, QR, OCR, floutage, e-mails…)
│   │   ├── models/           # SQLAlchemy 2
│   │   ├── schemas/          # Pydantic v2
│   │   ├── core/             # configuration, sécurité, erreurs, limitation de débit
│   │   └── templates/emails/ # e-mails HTML aux couleurs d'Orea
│   ├── alembic/              # migrations
│   ├── scripts/              # seed.py, make_specimens.py
│   ├── specimens/            # 3 fausses pièces « SPÉCIMEN »
│   └── tests/                # pytest
├── frontend/                 # Next.js 16 (App Router) · TypeScript
│   └── src/
│       ├── app/              # pages : accueil, recherche, déclarer, réclamer, espaces
│       ├── components/       # brand (logo, Ori), landing, map, ui (shadcn), feedback
│       └── lib/              # client API, types, constantes, confettis
└── docs/
    ├── architecture.md       # schémas Mermaid : architecture, base de données, statuts
    └── PHASE1_PLAN.md        # plan initial et design system
```

**Stack.**
- **Backend :** FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 · Pydantic v2 · JWT + bcrypt · EasyOCR · OpenCV · RapidFuzz · qrcode · slowapi · SMTP (Mailpit) · pytest.
- **Frontend :** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Framer Motion · canvas-confetti · React Hook Form + Zod · TanStack Query · Leaflet + OpenStreetMap · qr-scanner · Recharts.

Les **schémas Mermaid** (architecture, base de données, parcours de restitution, cycle de vie des statuts) sont dans [docs/architecture.md](docs/architecture.md).

**Correspondance des noms.**
1. Les noms sont normalisés : minuscules, sans accents, sans ponctuation, espaces réduits.
2. Le score est calculé avec RapidFuzz `token_sort_ratio`, sur des pièces du même type uniquement.
3. Seuil : **85**, configurable.
4. Une date de naissance différente écarte un homonyme. Un numéro identique donne une correspondance certaine.
5. La correspondance est lancée à chaque nouvelle déclaration, dans les deux sens.

---

## Développement local sans Docker

```bash
# Base de données et boîte e-mail seulement
docker compose up -d db mailpit

# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows  (source .venv/bin/activate ailleurs)
pip install -e ".[dev,ocr]"
alembic upgrade head
python -m scripts.seed --if-empty
uvicorn app.main:app --reload                       # http://localhost:8000/docs

# Frontend (autre terminal)
cd frontend
npm install
npm run dev                                         # http://localhost:3000
```

L'extra `ocr` (EasyOCR + PyTorch) est facultatif : sans lui, l'application fonctionne et le formulaire se remplit à la main.

---

## Tests

```bash
cd backend
pytest              # 121 tests rapides, base SQLite en mémoire, OCR simulé
pytest -m slow      # 3 tests avec le VRAI modèle EasyOCR sur les spécimens
```

Ce qui est couvert : correspondance (accents, prénoms inversés, fautes, homonymes, numéro), hachage, QR codes (unicité, expiration, usage unique, mauvais relais), authentification (rotation et réutilisation des jetons), routes principales, OCR et floutage, envoi d'e-mails, limitation de débit.

---

## Configuration

Copie [`.env.example`](.env.example) en `.env`. Chaque variable y est documentée. Avant toute mise en production, régénère les trois secrets :

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

`JWT_SECRET`, `DOC_NUMBER_PEPPER` et `QR_SECRET`. ⚠️ Changer `DOC_NUMBER_PEPPER` rend invérifiables toutes les empreintes de numéros déjà enregistrées.
