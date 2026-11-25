# Scénario de démo · 3 minutes

**L'histoire :** Aya a perdu sa CNI à Cocody. Koffi la trouve dans un gbaka. Grâce à Orea, la pièce revient à Aya en quelques minutes, sans que personne ne voie son numéro.

## Avant de commencer (5 minutes avant le passage)

1. Lancer l'API et le site (voir « Lancement en local » dans le README), puis vérifier que http://localhost:3000 s'affiche.
2. Remettre la démo à zéro : `cd backend` puis `.venv\Scripts\python -m scripts.seed --reset`
3. **Faire un scan de test** (spécimen CNI) puis remettre à zéro : le premier scan charge le modèle OCR (environ 25 s), les suivants sont rapides.
4. Ouvrir **3 onglets** et un dossier (la fenêtre de navigation privée sert au 2e compte, car chaque fenêtre garde sa propre session) :

| Onglet | Adresse | Compte |
|---|---|---|
| A | http://localhost:3000 | non connecté |
| B (fenêtre privée) | http://localhost:3000/connexion | `koffi@orea.ci` |
| C (fenêtre normale) | http://localhost:3000/connexion | `aya@orea.ci` puis `relais.cocody@orea.ci` |
| D | dossier `backend/outbox/` | les e-mails envoyés, en fichiers HTML |

Mot de passe de tous les comptes : **`Orea2026!`**. Sur la page de connexion, l'encart « Comptes de démonstration » remplit le formulaire en un clic.

> **Astuce :** activer le mode sombre (icône lune) une fois pendant la démo, ça fait toujours son effet.

---

## Déroulé

### 0:00 – 0:30 · La promesse (onglet A, page d'accueil)

- Lire l'accroche : *« Ta pièce perdue est peut-être déjà au coin de la rue. »*
- Montrer l'animation à droite : photo → formulaire qui se remplit → « Bonne nouvelle, ta CNI t'attend à Cocody ! »
- Bouger la souris : **Ori**, la mascotte tirée de l'épingle du logo, suit le curseur des yeux.
- Défiler rapidement : bandeau des pièces acceptées, 3 étapes, sécurité, **carte des 6 points relais**, compteurs animés.

> 🎤 « En 3 secondes, on comprend le service : on trouve, on dépose, on récupère. »

### 0:30 – 1:20 · Koffi trouve la CNI (onglet B, connecté en Koffi)

1. Cliquer sur **J'ai trouvé**.
2. Dans l'encart « Démo », cliquer sur **Spécimen CNI**. Ori lit la pièce pendant quelques secondes.
3. Montrer le **formulaire pré-rempli** : type CNI, `KOUASSI AYA MARIE`, date de naissance, numéro. Les champs moins sûrs sont entourés en orange « À vérifier ».
4. Montrer l'**aperçu flouté** à droite : « X zones floutées automatiquement, l'original a été supprimé ».
5. Choisir la commune **Cocody**, puis **Continuer**.
6. Sur la carte, cliquer sur l'épingle **Relais Orea · Cocody Deux-Plateaux**, puis **Valider**.
7. 🎉 **Confettis** : « Incroyable : son propriétaire la cherchait déjà ! »

> 🎤 « La photo n'est jamais affichée en public, et le numéro est haché dès sa réception : même nous, on ne peut pas le relire. »

### 1:20 – 1:45 · Aya est prévenue (onglets D puis C)

1. **Dossier `backend/outbox/` :** ouvrir le dernier fichier dans le navigateur : l'e-mail « Bonne nouvelle, ta CNI t'attend à Cocody ! » est là, aux couleurs d'Orea.
2. **Onglet C :** être connecté en **Aya** *avant* que Koffi valide sa déclaration, et laisser l'onglet ouvert. Dès que Koffi valide, **l'écran d'Aya s'illumine tout seul** en 2 à 5 secondes : confettis, Ori qui saute, « Bonne nouvelle, ta CNI t'attend à Cocody ! ». C'est le moment fort de la démo.
3. Cliquer sur **Récupérer ma pièce**, ou ouvrir **Mon espace → Mes pertes** : la jauge « Pourquoi Orea pense que c'est la tienne » affiche 100 %, avec ses raisons.

> 🎤 « La correspondance marche même si Koffi a lu *KOUASSI Aya Marie* et qu'Aya a écrit *Aya Marie Kouassi* : l'ordre des prénoms et les fautes sont tolérés. »

### 1:45 – 2:20 · Aya prouve que c'est sa pièce (onglet C, en Aya)

1. Cliquer sur **C'est la mienne**.
2. Saisir d'abord un **mauvais numéro**, par exemple `CI 1111 2222 33` : « il te reste 4 essais ».
3. Saisir le bon numéro : **`CI 0099 1234 56`**.
4. 🎉 **Confettis** et **billet de retrait** : QR code, code de secours, point relais, valable 14 jours.
5. **Noter le code de secours** (format `XXXX-XXXX-XXXX`) : il servira à l'étape suivante si la caméra ne coopère pas.

> 🎤 « 5 erreurs et la réclamation est bloquée 24 h. Le QR est unique, à usage unique, et ne marche qu'au bon point relais. »

### 2:20 – 2:50 · Restitution au point relais (onglet C)

1. Se déconnecter, puis se connecter en **`relais.cocody@orea.ci`**.
2. Dans **À réceptionner**, cliquer sur **Confirmer la réception** de la CNI.
3. Valider le retrait de l'une de ces deux façons :
   - **Lancer le scan** et présenter le QR (affiché sur un téléphone) ;
   - ou taper le **code de secours** puis cliquer sur **Vérifier**.
4. La fenêtre de contrôle affiche la pièce et le nom d'Aya. Cliquer sur **Remettre la pièce**.
5. 🎉 Confettis : « Pièce restituée à Aya Kouassi ! »
6. Démonstration de sécurité : **retaper le même code** → « Ce QR code a déjà été utilisé ».

### 2:50 – 3:00 · Le pilotage (onglet C, en `admin@orea.ci`)

- Ouvrir **Administration** : le **centre de contrôle** s'affiche, avec la carte thermique d'Abidjan en mode nuit, le flux d'activité en direct (la restitution qu'on vient de faire y apparaît), l'anneau de réussite et l'entonnoir « signalée → restituée ».

> **Bonus si le temps le permet :** dans l'espace d'Aya, le bouton **Avis de recherche** génère une affiche avec QR code, à partager dans les groupes WhatsApp.

> 🎤 « Orea : une photo, un point relais, une bonne action. »

---

## Plan B

| Problème | Solution |
|---|---|
| La caméra ne s'ouvre pas | Utiliser le **code de secours** du billet de retrait. |
| L'OCR est lent au premier scan | C'est le chargement du modèle (une seule fois). Faire un scan de test avant le passage. |
| La lecture échoue | Cliquer sur « Remplir à la main » et saisir les champs du spécimen (numéro `CI 0099 1234 56`). |
| La démo a déjà été jouée | `docker compose exec api python -m scripts.seed --reset` |
| Pas d'internet | Tout fonctionne hors ligne (modèles OCR inclus dans l'image), sauf le fond de carte OpenStreetMap : la liste des points relais reste affichée à côté. |

**Pour aller plus loin si le jury pose des questions :** les spécimens permis (`fabrice@orea.ci`) et passeport (`awa@orea.ci`) déclenchent aussi une correspondance. Sur le passeport, la date de naissance est cachée par le filigrane ; Orea la retrouve en lisant la bande MRZ.
