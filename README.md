# GC Growth API — Backend Vercel

Backend Node.js/TypeScript pour **GC Growth OS**.  
Déployé sur Vercel, connecté à Supabase et Shopify.

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/shopify/connect` | Vérifie le token Shopify, sauvegarde en BDD |
| POST | `/api/shopify/sync` | Récupère les commandes Shopify → daily stats |
| POST | `/api/claude/generate` | Proxy sécurisé vers Claude Sonnet (clé côté serveur) |
| GET  | `/api/health` | Vérifie que le service tourne et les env vars sont configurées |

---

## Déploiement rapide

### 1. Base de données Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Va dans **SQL Editor** et colle le contenu de `supabase-schema.sql`
3. Récupère dans **Project Settings → API** :
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

### 2. Déploiement Vercel

```bash
# Clone / push ce repo sur GitHub
git init && git add . && git commit -m "init"
git remote add origin https://github.com/TON_USERNAME/gcgrowthapi.git
git push -u origin main
```

Puis dans Vercel Dashboard :
1. **Import** le repo GitHub
2. **Settings → Environment Variables**, ajoute :

```
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = eyJ...
ANTHROPIC_API_KEY     = sk-ant-...
ALLOWED_ORIGINS       = *
```

3. **Redeploy** → ton API est live sur `https://gcgrowthapi.vercel.app`

### 3. Vérification

```bash
curl https://gcgrowthapi.vercel.app/api/health
# → { "status": "ok", "checks": { "supabase": true, "anthropic": true } }
```

### 4. Test CORS

```bash
curl -X OPTIONS https://gcgrowthapi.vercel.app/api/shopify/connect \
  -H "Origin: http://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -v
# → HTTP 204 + Access-Control-Allow-Origin: *
```

---

## Développement local

```bash
npm install
cp .env.example .env.local   # remplis les valeurs
npx vercel dev               # démarre sur http://localhost:3000
```

---

## Structure

```
gcgrowthapi/
├── api/
│   ├── health.ts                  # GET  /api/health
│   ├── claude/
│   │   └── generate.ts            # POST /api/claude/generate
│   └── shopify/
│       ├── connect.ts             # POST /api/shopify/connect
│       └── sync.ts                # POST /api/shopify/sync
├── lib/
│   ├── cors.ts                    # CORS helper partagé
│   ├── supabase.ts                # Client Supabase singleton
│   └── shopify.ts                 # Helpers Shopify API
├── supabase-schema.sql            # Schema BDD à exécuter une fois
├── vercel.json                    # Config Vercel + headers CORS globaux
├── .env.example                   # Template variables d'environnement
└── package.json
```

---

## Notes de sécurité

- Le `shopify_token` est stocké en clair dans Supabase.  
  En production, chiffre-le avec `pgcrypto` ou un service KMS.
- `SUPABASE_SERVICE_KEY` contourne le RLS — ne l'expose jamais côté client.
- Change `ALLOWED_ORIGINS=*` en production pour mettre uniquement l'URL de ton app.
