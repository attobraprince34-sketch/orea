# Orea — Architecture et base de données

## 1. Architecture générale

```mermaid
flowchart LR
    subgraph Client["Navigateur (téléphone / ordinateur)"]
        WEB["Next.js · App Router<br/>TanStack Query · Framer Motion<br/>Leaflet · lecteur de QR"]
    end

    subgraph Docker["docker compose up"]
        NEXT["web :3000<br/>Next.js"]
        API["api :8000<br/>FastAPI · Swagger /docs"]
        DB[("PostgreSQL 16")]
        MAIL["Mailpit<br/>SMTP :1025 · UI :8025"]
        VOL[["Volume privé<br/>photos floutées"]]
    end

    WEB --> NEXT
    WEB -- "REST JSON + JWT<br/>(refresh en cookie httpOnly)" --> API
    API -- "SQLAlchemy 2 · Alembic" --> DB
    API -- "SMTP" --> MAIL
    API --> VOL
```

### Couches du backend

```mermaid
flowchart TB
    R["api/routes<br/><i>HTTP : validation, rôles, codes de statut</i>"]
    S["services<br/><i>règles métier, sans dépendance HTTP</i>"]
    M["models<br/><i>tables SQLAlchemy</i>"]
    SC["schemas<br/><i>entrées / sorties Pydantic v2</i>"]
    C["core<br/><i>config · sécurité · erreurs · limitation de débit</i>"]

    R --> S --> M
    R --> SC
    S --> SC
    R -.-> C
    S -.-> C
```

Les routes ne contiennent aucune règle métier : elles valident l'entrée, appellent un
service, valident la transaction (`commit`) puis programment les e-mails. Les services
sont testables directement, et réutilisés par le script de démonstration.

### Parcours « restitution »

```mermaid
sequenceDiagram
    autonumber
    actor T as Trouveur
    actor P as Propriétaire
    participant API as API Orea
    actor R as Agent du point relais

    P->>API: POST /lost (déclare sa perte)
    T->>API: POST /found (photo → OCR → formulaire)
    API->>API: correspondance RapidFuzz (≥ 85)
    API-->>P: « Bonne nouvelle, ta CNI t'attend à Cocody ! »
    R->>API: POST /relay/documents/{id}/receive
    P->>API: POST /claims (numéro de la pièce)
    API->>API: HMAC(numéro) == empreinte stockée ?
    API-->>P: QR code unique (14 jours, usage unique)
    R->>API: POST /relay/pickup/verify (scan)
    API-->>R: aperçu : pièce + identité du réclamant
    R->>API: POST /relay/pickup/confirm
    API-->>P: « Et voilà, ta CNI est de retour ! »
    API-->>T: « Grâce à toi, quelqu'un a retrouvé ses papiers »
```

## 2. Base de données

```mermaid
erDiagram
    USERS ||--o{ FOUND_DOCUMENTS : "trouve"
    USERS ||--o{ LOST_REPORTS : "perd"
    USERS ||--o{ CLAIMS : "réclame"
    USERS ||--o{ CLAIM_ATTEMPTS : "tente"
    USERS ||--o{ NOTIFICATIONS : "reçoit"
    USERS ||--o{ REFRESH_TOKENS : "possède"
    RELAY_POINTS |o--o{ USERS : "emploie (agents)"
    RELAY_POINTS ||--o{ FOUND_DOCUMENTS : "conserve"
    FOUND_DOCUMENTS ||--o{ MATCHES : ""
    LOST_REPORTS ||--o{ MATCHES : ""
    FOUND_DOCUMENTS ||--o{ CLAIMS : ""
    FOUND_DOCUMENTS ||--o{ CLAIM_ATTEMPTS : ""
    LOST_REPORTS |o--o{ CLAIMS : "rattachée à"
    CLAIMS ||--|| PICKUP_CODES : "génère"

    USERS {
        uuid id PK
        string email UK
        string password_hash "bcrypt"
        string full_name
        string phone
        string role "user | relay | admin"
        bool is_active
        uuid relay_point_id FK "agents uniquement"
        datetime last_login_at
        datetime created_at
    }
    RELAY_POINTS {
        uuid id PK
        string name
        string commune "13 communes d'Abidjan"
        string address
        float latitude
        float longitude
        string opening_hours
        string phone
        bool is_active
    }
    FOUND_DOCUMENTS {
        uuid id PK
        uuid finder_id FK
        uuid relay_point_id FK
        string doc_type
        string holder_name "jamais exposé publiquement"
        string holder_name_norm "pour la correspondance"
        string holder_initials "seule donnée publique"
        date birth_date
        string number_hash "HMAC-SHA256, jamais en clair"
        string commune_found
        date found_on
        string blurred_photo_path "privé"
        string status
        datetime received_at
        datetime returned_at
    }
    LOST_REPORTS {
        uuid id PK
        uuid owner_id FK
        string doc_type
        string holder_name
        string holder_name_norm
        string holder_initials
        date birth_date
        string number_hash "facultatif"
        string commune_lost
        date lost_on
        string status
    }
    MATCHES {
        uuid id PK
        uuid found_document_id FK
        uuid lost_report_id FK
        float score "0 à 100"
    }
    CLAIMS {
        uuid id PK
        uuid found_document_id FK
        uuid claimant_id FK
        uuid lost_report_id FK
        string status "active | completed | expired | cancelled"
        datetime completed_at
    }
    PICKUP_CODES {
        uuid id PK
        uuid claim_id FK "unique"
        string nonce "aléatoire, 128 bits"
        string token_hash "SHA-256 du jeton du QR"
        string short_code_hash "code de secours"
        datetime expires_at "+14 jours"
        datetime used_at "usage unique"
        uuid validated_by_id FK
    }
    CLAIM_ATTEMPTS {
        uuid id PK
        uuid user_id FK
        uuid found_document_id FK
        bool success
        string ip_address
        datetime created_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string kind
        string title
        string body
        string link
        bool read
    }
    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        string jti UK
        datetime expires_at
        datetime revoked_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        string action
        string target
        json meta
        datetime created_at
    }
```

### Cycle de vie d'une déclaration

```mermaid
stateDiagram-v2
    [*] --> pending : déclaration
    pending --> matched : correspondance ≥ seuil
    pending --> claimed : réclamation directe (via la recherche)
    matched --> claimed : numéro vérifié → QR code
    claimed --> returned : QR scanné et validé au relais
    claimed --> matched : QR expiré (14 j)
    pending --> expired : 90 j sans suite
    matched --> expired : 90 j sans suite
    pending --> cancelled : retrait / modération
    matched --> cancelled : retrait / modération
    returned --> [*]
```
