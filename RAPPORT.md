# TP Cloud Computing — Sujet 2 : Application de Messagerie Simple
## Rapport Technique — Architecture Serverless avec Supabase

---

## 1. Architecture Générale

### 1.1 Schéma des composants

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React 19 + Vite + TypeScript + Tailwind CSS                    │
│                                                                   │
│   ┌──────────────┐   ┌───────────────┐   ┌──────────────────┐  │
│   │  AuthPage    │   │  ChatPage     │   │  useMessages     │  │
│   │  (Login /    │   │  (Sidebar +   │   │  (Realtime sub.) │  │
│   │   Register)  │   │   Messages)   │   │                  │  │
│   └──────┬───────┘   └───────┬───────┘   └────────┬─────────┘  │
│          │                   │                     │             │
└──────────┼───────────────────┼─────────────────────┼────────────┘
           │                   │                     │
           ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE SDK (supabase-js)                    │
│         Couche d'abstraction — auto-reconnexion JWT              │
└────────┬──────────────┬──────────────┬──────────────────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐
   │  Auth    │  │  Data    │  │      Realtime                │
   │  (JWT)   │  │  API     │  │  (WebSocket / CDC Postgres)  │
   │          │  │  (REST/  │  │                              │
   │  signup  │  │  PostgREST│  │  channel: messages:{id}      │
   │  signin  │  │  )       │  │  event: INSERT               │
   └──────────┘  └──────────┘  └──────────────────────────────┘
         │              │
         ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE BACKEND (BaaS)                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            PostgreSQL 15 (managed)                       │    │
│  │                                                          │    │
│  │  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐ │    │
│  │  │ profiles │  │ conversations │  │     messages     │ │    │
│  │  │ (auth)   │  │               │  │  (RLS policies)  │ │    │
│  │  └──────────┘  └───────────────┘  └──────────────────┘ │    │
│  │         ↑ RLS activé sur toutes les tables ↑            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            Edge Functions (Deno — FaaS)                  │    │
│  │                                                          │    │
│  │  POST /functions/v1/send-message   → validation + insert │    │
│  │  GET  /functions/v1/get-messages   → lecture paginée     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Flux de données

#### Flux d'envoi d'un message
```
Client → supabase.functions.invoke('send-message', { body })
       → Edge Function (Deno) : vérif JWT + participation
       → INSERT INTO messages (RLS vérifié)
       → Supabase Realtime (CDC) détecte l'INSERT
       → WebSocket push vers tous les abonnés du channel
       → useMessages hook met à jour le state React
       → Re-render MessageList
```

#### Flux d'authentification
```
Client → supabase.auth.signInWithPassword(email, password)
       → Supabase Auth vérifie les credentials
       → Retourne JWT (access_token + refresh_token)
       → Stocké dans localStorage (persistSession: true)
       → onAuthStateChange déclenché → App bascule sur ChatPage
```

#### Flux de lecture temps réel
```
useMessages → supabase.channel('messages:{id}')
            .on('postgres_changes', { event: 'INSERT', ... })
            → Subscribe (WebSocket upgrade)
            → Chaque INSERT sur messages déclenche le callback
            → Message enrichi avec profil expéditeur
            → setMessages([...prev, newMessage])
```

---

## 2. Justification des choix techniques

### 2.1 Supabase à la place de Firebase

| Critère             | Firebase (Firestore)        | Supabase (PostgreSQL)              |
|---------------------|-----------------------------|------------------------------------|
| **Base de données** | NoSQL (documents)           | SQL relationnel (PostgreSQL 15)    |
| **Requêtes**        | Limitées, pas de JOIN       | SQL complet, JOIN, agrégations     |
| **Sécurité**        | Security Rules              | Row Level Security (RLS natif)     |
| **Open source**     | Non (propriétaire Google)   | Oui (MIT) — auto-hébergeable       |
| **Temps réel**      | Realtime Database           | CDC Postgres via WebSocket         |
| **FaaS**            | Cloud Functions (Node.js)   | Edge Functions (Deno — V8 Isolates)|
| **Coût**            | Pay-as-you-go               | Free tier généreux, prévisible     |
| **Auth**            | Firebase Auth               | GoTrue (JWT) + PKCE               |

**Choix retenu : Supabase** pour la puissance du SQL, l'open source, et l'intégration native RLS + Realtime.

### 2.2 Architecture Serverless

L'application ne comporte **aucun serveur à gérer** :
- **BaaS (Backend as a Service)** : Supabase héberge PostgreSQL, Auth, Realtime, Storage
- **FaaS (Function as a Service)** : Edge Functions Deno pour la logique métier
- **Frontend statique** : React buildé → servi via CDN (Vercel/Netlify)

Avantages : zéro configuration serveur, scalabilité automatique, coût proportionnel à l'usage.

### 2.3 Realtime via Supabase

Supabase Realtime utilise **PostgreSQL Change Data Capture (CDC)** :
1. Postgres publie les changements via `supabase_realtime` publication
2. Un service Elixir (Phoenix Channels) reçoit ces changements
3. Les clients connectés via WebSocket reçoivent les payloads en temps réel
4. Le SDK côté client met à jour le state React sans polling

### 2.4 Row Level Security (RLS)

RLS garantit l'isolation des données **au niveau base de données** :
- Un utilisateur ne peut lire que les messages des conversations où il participe
- Même si la clé anon est exposée côté client, les politiques RLS bloquent tout accès non autorisé
- Les Edge Functions utilisent le JWT de l'utilisateur → RLS s'applique également

---

## 3. Schéma de la base de données

```sql
auth.users           -- géré par Supabase Auth
    │
    ├── profiles      -- profil public (trigger auto-création)
    │     id, email, display_name, avatar_url
    │
    ├── conversations -- conversations (1-à-1 ou groupe)
    │     id, name, is_group, created_by, updated_at
    │
    ├── conversation_participants  -- qui est dans quelle conversation
    │     conversation_id, user_id  (PK composite)
    │
    └── messages      -- messages avec RLS stricte
          id, conversation_id, sender_id, content, created_at
```

---

## 4. Edge Functions — Démonstration FaaS

### 4.1 send-message — Envoi d'un message

**Endpoint** : `POST /functions/v1/send-message`

**Headers requis** :
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body** :
```json
{
  "conversation_id": "uuid-de-la-conversation",
  "content": "Bonjour !"
}
```

**Exemple cURL** :
```bash
curl -X POST \
  'https://VOTRE_PROJET.supabase.co/functions/v1/send-message' \
  -H 'Authorization: Bearer VOTRE_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"conversation_id":"<uuid>","content":"Hello depuis le TP !"}'
```

**Réponse succès (201)** :
```json
{
  "data": {
    "id": "msg-uuid",
    "conversation_id": "conv-uuid",
    "sender_id": "user-uuid",
    "content": "Hello depuis le TP !",
    "created_at": "2024-01-01T12:00:00.000Z",
    "profiles": {
      "id": "user-uuid",
      "display_name": "Jean Dupont",
      "email": "jean@exemple.com"
    }
  }
}
```

### 4.2 get-messages — Lecture des messages (API REST)

**Endpoint** : `GET /functions/v1/get-messages?conversation_id=<uuid>&limit=50&offset=0`

**Exemple cURL** :
```bash
curl -G \
  'https://VOTRE_PROJET.supabase.co/functions/v1/get-messages' \
  -H 'Authorization: Bearer VOTRE_JWT_TOKEN' \
  --data-urlencode 'conversation_id=<uuid>' \
  --data-urlencode 'limit=50' \
  --data-urlencode 'offset=0'
```

**Réponse (200)** :
```json
{
  "data": [
    {
      "id": "msg-1",
      "content": "Bonjour !",
      "created_at": "2024-01-01T12:00:00.000Z",
      "profiles": { "display_name": "Alice" }
    }
  ],
  "meta": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

---

## 5. Guide de déploiement

### 5.1 Prérequis

```bash
# Node.js >= 18
node --version

# Supabase CLI
npm install -g supabase

# Vérification
supabase --version
```

### 5.2 Configuration locale

```bash
# 1. Cloner le projet
git clone <repo-url>
cd tp2-messagerie-simple

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés Supabase (Dashboard > Settings > API)
```

### 5.3 Appliquer le schéma SQL

**Option A — Via le Dashboard Supabase (recommandé)**
1. Ouvrir Supabase Dashboard > SQL Editor
2. Copier-coller le contenu de `supabase/migrations/20240101000000_initial_schema.sql`
3. Cliquer "Run"

**Option B — Via Supabase CLI**
```bash
# Se connecter à Supabase
supabase login

# Lier au projet cloud
supabase link --project-ref VOTRE_PROJECT_REF

# Appliquer la migration
supabase db push
```

**Option C — Développement local**
```bash
# Démarrer Supabase en local (Docker requis)
supabase start

# Appliquer la migration locale
supabase migration up
```

### 5.4 Déployer les Edge Functions

```bash
# Déployer send-message
supabase functions deploy send-message

# Déployer get-messages
supabase functions deploy get-messages

# Vérifier le déploiement
supabase functions list
```

### 5.5 Activer Supabase Realtime

Dans le Dashboard Supabase :
1. Database > Replication
2. Activer `supabase_realtime` pour les tables `messages` et `conversations`

Ou via SQL (déjà inclus dans la migration) :
```sql
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
```

### 5.6 Lancer l'application

```bash
# Développement
npm run dev
# → http://localhost:5173

# Build de production
npm run build
npm run preview
```

### 5.7 Déploiement cloud (Vercel)

```bash
# Installer Vercel CLI
npm install -g vercel

# Déployer
vercel --prod

# Ajouter les variables d'environnement
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
```

---

## 6. Tests et vérification

### 6.1 Test d'authentification via l'API REST Supabase

```bash
# Créer un compte
curl -X POST \
  'https://VOTRE_PROJET.supabase.co/auth/v1/signup' \
  -H 'apikey: VOTRE_PUBLISHABLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@exemple.com","password":"motdepasse123"}'

# Se connecter et récupérer le JWT
curl -X POST \
  'https://VOTRE_PROJET.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: VOTRE_PUBLISHABLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@exemple.com","password":"motdepasse123"}'
```

### 6.2 Test de l'API Data (PostgREST)

```bash
# Lire les profils (nécessite JWT)
curl \
  'https://VOTRE_PROJET.supabase.co/rest/v1/profiles' \
  -H 'apikey: VOTRE_PUBLISHABLE_KEY' \
  -H 'Authorization: Bearer VOTRE_JWT'

# Lire les messages d'une conversation
curl \
  'https://VOTRE_PROJET.supabase.co/rest/v1/messages?conversation_id=eq.UUID&order=created_at.asc' \
  -H 'apikey: VOTRE_PUBLISHABLE_KEY' \
  -H 'Authorization: Bearer VOTRE_JWT'
```

### 6.3 Test Edge Function send-message

```bash
export JWT="votre_token_jwt"
export PROJECT="votre_project_ref"
export CONV_ID="uuid_conversation"

curl -X POST \
  "https://${PROJECT}.supabase.co/functions/v1/send-message" \
  -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" \
  -d "{\"conversation_id\":\"${CONV_ID}\",\"content\":\"Test depuis le TP Cloud Computing\"}"
```

### 6.4 Vérification de l'écriture en base

```sql
-- Dans Supabase SQL Editor
SELECT 
  m.content,
  m.created_at,
  p.display_name as sender,
  c.name as conversation
FROM messages m
JOIN profiles p ON p.id = m.sender_id
JOIN conversations c ON c.id = m.conversation_id
ORDER BY m.created_at DESC
LIMIT 10;
```

### 6.5 Collection Postman

Importer dans Postman :
```json
{
  "info": { "name": "TP2 MessageApp" },
  "variable": [
    { "key": "base_url", "value": "https://VOTRE_PROJET.supabase.co" },
    { "key": "publishable_key", "value": "VOTRE_PUBLISHABLE_KEY" },
    { "key": "jwt", "value": "" }
  ],
  "item": [
    {
      "name": "Sign In",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/auth/v1/token?grant_type=password",
        "header": [
          { "key": "apikey", "value": "{{publishable_key}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"test@exemple.com\",\"password\":\"password123\"}"
        }
      }
    },
    {
      "name": "Send Message (Edge Function)",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/functions/v1/send-message",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt}}" },
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\"conversation_id\":\"UUID\",\"content\":\"Hello !\"}"
        }
      }
    },
    {
      "name": "Get Messages (Edge Function)",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/functions/v1/get-messages?conversation_id=UUID&limit=50",
        "header": [
          { "key": "Authorization", "value": "Bearer {{jwt}}" }
        ]
      }
    }
  ]
}
```

---

## 7. Analyse critique

### 7.1 Avantages de l'architecture Supabase Serverless

**1. Productivité développeur**
- Démarrage en 15 minutes (SDK auto-généré, auth prête à l'emploi)
- SDK TypeScript typé → moins de bugs au runtime
- Dashboard visuel pour explorer les données et tester les requêtes

**2. Scalabilité automatique**
- Pas de serveur à provisionner ni à maintenir
- Edge Functions déployées dans 15+ régions (Cloudflare Workers model)
- PostgreSQL managed avec backups automatiques

**3. Sécurité par défaut**
- RLS activé sur toutes les tables → isolation des données garantie
- JWT signés par Supabase Auth → impossible de forger un token
- Clé publishable safe pour le frontend (RLS + politiques)

**4. Temps réel natif**
- WebSocket intégré sans configuration
- CDC (Change Data Capture) Postgres → données toujours cohérentes
- Latence typique < 100ms sur un réseau correct

**5. Open source et vendor lock-in limité**
- PostgreSQL standard → exportable à tout moment
- Supabase self-hostable avec Docker

### 7.2 Inconvénients et limites

**1. Cold starts des Edge Functions**
- Première requête après inactivité : +100-500ms (Deno V8 isolate)
- Moins problématique qu'AWS Lambda (pas de JVM/Node init)
- Solution : keep-alive pings ou passer par PostgREST directement

**2. Coûts en production**
- Free tier : 500MB DB, 2GB bande passante, 500K fonctions/mois
- Dépassement → coûts peuvent surprendre sur un projet à fort trafic
- Solution : monitorer avec Supabase Dashboard + alertes

**3. Complexité du Realtime à grande échelle**
- Limite de connexions WebSocket simultanées (free tier : 200)
- Pas de compression des payloads sur les canaux broadcast
- Solution : utiliser Broadcast pour les volumes élevés

**4. Dépendance PostgreSQL**
- Migrations complexes sur des schemas existants
- Pas de NoSQL natif (mais JSONB compense en partie)

**5. Debug des Edge Functions**
- Logs via `supabase functions logs` — moins ergonomique qu'un vrai APM
- Pas de debugger distant natif

---

## 8. Conclusion

Ce TP démontre qu'une **application de messagerie complète** peut être construite avec une architecture entièrement serverless en utilisant **Supabase comme BaaS**.

### Points clés implémentés

| Contrainte TP          | Solution retenue                                      |
|------------------------|-------------------------------------------------------|
| Architecture serverless | React statique + Supabase BaaS + Edge Functions       |
| BaaS                   | Supabase (Auth, Database, Realtime, Functions)        |
| FaaS                   | Edge Functions Deno : `send-message`, `get-messages`  |
| Authentification       | Supabase Auth (email/password, JWT)                   |
| Stockage conversations | PostgreSQL avec RLS — `conversations` + `messages`    |
| Lecture messages API   | `get-messages` Edge Function + PostgREST              |
| Temps réel             | Supabase Realtime (WebSocket + PostgreSQL CDC)        |
| Prototype fonctionnel  | Interface React complète, responsive, dark theme      |

### Verdict

Supabase représente un excellent choix pour des projets **startup ou TP** nécessitant un backend complet rapidement. La combinaison PostgreSQL + RLS + Realtime + Edge Functions couvre la quasi-totalité des besoins d'une application moderne avec une surface de configuration minimale.

Pour un projet de production à grande échelle, il faudra investir dans la gestion des coûts, le monitoring, et potentiellement auto-héberger Supabase pour garder le contrôle total des données.

---

## Structure du rendu final

```
tp2-messagerie-simple/
│
├── RAPPORT.md                          ← Ce fichier
├── .env.example                        ← Template variables d'environnement
│
├── supabase/
│   ├── config.toml                     ← Config CLI (dev local)
│   ├── migrations/
│   │   └── 20240101000000_initial_schema.sql  ← Schéma SQL complet
│   └── functions/
│       ├── send-message/index.ts       ← Edge Function FaaS (envoi)
│       └── get-messages/index.ts      ← Edge Function FaaS (lecture)
│
└── src/
    ├── lib/supabase.ts                 ← Client Supabase initialisé
    ├── types/index.ts                  ← Types TypeScript
    ├── hooks/
    │   ├── useAuth.ts                  ← Authentification + session
    │   ├── useConversations.ts         ← CRUD conversations
    │   └── useMessages.ts             ← Messages + Realtime
    ├── components/
    │   ├── auth/AuthForm.tsx           ← Formulaire Login/Register
    │   └── chat/
    │       ├── ConversationList.tsx    ← Sidebar conversations
    │       ├── MessageList.tsx        ← Affichage messages
    │       ├── MessageInput.tsx       ← Zone de saisie
    │       └── NewConversationModal.tsx ← Création conversation
    └── pages/
        ├── AuthPage.tsx               ← Page d'authentification
        └── ChatPage.tsx              ← Interface de chat principale
```
