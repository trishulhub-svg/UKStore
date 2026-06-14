#!/bin/bash
# ============================================================
# Fresh Mart London - Supabase Setup (Shell Script)
# ============================================================
# 
# This script creates a Supabase project and sets up the database
# using the Supabase Management API (curl) and CLI.
#
# PREREQUISITES:
#   - curl, jq
#   - SUPABASE_ACCESS_TOKEN env var set
#
# USAGE:
#   export SUPABASE_ACCESS_TOKEN=sbp_your_token_here
#   bash scripts/setup-supabase.sh
#
# ============================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────
PROJECT_NAME="Fresh Mart London"
PROJECT_REGION="eu-west-2"
PROJECT_PLAN="free"
DB_PASSWORD="${SUPABASE_DB_PASS:-FreshMart2026!Secure}"
API_BASE="https://api.supabase.com/v1"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
SEED_FILE="$ROOT_DIR/supabase/seed/seed.sql"

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Check prerequisites ─────────────────────────────────────────
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
    error "SUPABASE_ACCESS_TOKEN is not set!"
    echo ""
    echo "Get your token at: https://supabase.com/dashboard/account/tokens"
    echo "Then run: export SUPABASE_ACCESS_TOKEN=sbp_your_token_here"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    warn "jq not found. Installing..."
    npm install -g json 2>/dev/null || true
fi

TOKEN="$SUPABASE_ACCESS_TOKEN"

# ── API helper ───────────────────────────────────────────────────
api_call() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    
    local args=(-s -X "$method" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json")
    
    if [ -n "$body" ]; then
        args+=(-d "$body")
    fi
    
    curl "${args[@]}" "${API_BASE}${path}"
}

# ── Step 1: Create project ──────────────────────────────────────
info "Creating Supabase project: '$PROJECT_NAME' in region $PROJECT_REGION..."

CREATE_BODY=$(cat <<EOF
{
    "name": "$PROJECT_NAME",
    "region": "$PROJECT_REGION",
    "plan": "$PROJECT_PLAN",
    "db_pass": "$DB_PASSWORD"
}
EOF
)

RESPONSE=$(api_call POST /projects "$CREATE_BODY")
PROJECT_REF=$(echo "$RESPONSE" | jq -r '.ref // empty')

if [ -z "$PROJECT_REF" ]; then
    error "Failed to create project!"
    echo "$RESPONSE" | jq .
    exit 1
fi

PROJECT_ID=$(echo "$RESPONSE" | jq -r '.id')
STATUS=$(echo "$RESPONSE" | jq -r '.status')

ok "Project creation initiated!"
echo "   Project ID: $PROJECT_ID"
echo "   Ref: $PROJECT_REF"
echo "   Status: $STATUS"

# ── Step 2: Wait for provisioning ───────────────────────────────
info "Waiting for project to finish provisioning (max 10 min)..."

MAX_ATTEMPTS=40
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    PROJECTS=$(api_call GET /projects)
    CURRENT_STATUS=$(echo "$PROJECTS" | jq -r ".[] | select(.ref == \"$PROJECT_REF\") | .status")
    
    echo "   [$ATTEMPT/$MAX_ATTEMPTS] Status: $CURRENT_STATUS"
    
    if [ "$CURRENT_STATUS" = "active" ]; then
        ok "Project is active and ready!"
        break
    fi
    
    if [ "$CURRENT_STATUS" = "failed" ]; then
        error "Project provisioning failed!"
        exit 1
    fi
    
    sleep 15
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    error "Project did not become active within 10 minutes."
    exit 1
fi

# Wait for database to stabilize
info "Waiting 30s for database to stabilize..."
sleep 30

# ── Step 3: Get API keys ────────────────────────────────────────
info "Fetching API keys..."

KEYS_RESPONSE=$(api_call GET "/projects/$PROJECT_REF/api-keys")
ANON_KEY=$(echo "$KEYS_RESPONSE" | jq -r '.[] | select(.name == "anon") | .api_key')
SERVICE_ROLE_KEY=$(echo "$KEYS_RESPONSE" | jq -r '.[] | select(.name == "service_role") | .api_key')

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    error "Could not find API keys!"
    echo "$KEYS_RESPONSE" | jq .
    exit 1
fi

PROJECT_URL="https://${PROJECT_REF}.supabase.co"

ok "Got API keys!"
echo "   URL: $PROJECT_URL"
echo "   Anon Key: ${ANON_KEY:0:20}..."
echo "   Service Role Key: ${SERVICE_ROLE_KEY:0:20}..."

# ── Step 4: Update .env file ────────────────────────────────────
info "Updating .env file..."

cat >> "$ENV_FILE" <<EOF

# ── Supabase Configuration (auto-added by setup script) ──
NEXT_PUBLIC_SUPABASE_URL=$PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF

ok "Environment variables appended to $ENV_FILE"

# ── Step 5: Run migrations ──────────────────────────────────────
info "Running 8 migration files via Management API..."

for MIG_FILE in 00001_initial_schema.sql 00002_rls_policies.sql 00003_auth_trigger.sql 00004_store_settings.sql 00005_profiles_nullable_store.sql 00006_fix_auth_schema.sql 00007_bootstrap_full_schema.sql 00008_urgent_fix_registration.sql; do
    MIG_PATH="$MIGRATIONS_DIR/$MIG_FILE"
    if [ ! -f "$MIG_PATH" ]; then
        warn "Migration file not found: $MIG_FILE - skipping"
        continue
    fi
    
    info "Running: $MIG_FILE..."
    
    # Read the SQL file and escape for JSON
    SQL_CONTENT=$(cat "$MIG_PATH" | jq -Rs .)
    
    RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $SQL_CONTENT}" \
        "${API_BASE}/projects/${PROJECT_REF}/database/query")
    
    # Check for errors
    if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        ERR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // .error')
        warn "Error in $MIG_FILE: $ERR_MSG"
    else
        ok "$MIG_FILE - OK"
    fi
done

# ── Step 6: Run seed ────────────────────────────────────────────
info "Running seed file..."

if [ -f "$SEED_FILE" ]; then
    SQL_CONTENT=$(cat "$SEED_FILE" | jq -Rs .)
    
    RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\": $SQL_CONTENT}" \
        "${API_BASE}/projects/${PROJECT_REF}/database/query")
    
    if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
        ERR_MSG=$(echo "$RESPONSE" | jq -r '.error.message // .error')
        warn "Error in seed: $ERR_MSG"
    else
        ok "seed.sql - OK"
    fi
else
    warn "Seed file not found: $SEED_FILE"
fi

# ── Step 7: Verify ──────────────────────────────────────────────
info "Verifying database connectivity..."

VERIFY_SQL="SELECT 'stores' as tbl, count(*) as cnt FROM stores UNION ALL SELECT 'categories', count(*) FROM categories UNION ALL SELECT 'products', count(*) FROM products;"

SQL_ESCAPED=$(echo "$VERIFY_SQL" | jq -Rs .)

VERIFY_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $SQL_ESCAPED}" \
    "${API_BASE}/projects/${PROJECT_REF}/database/query")

echo "   Verification query result:"
echo "$VERIFY_RESPONSE" | jq .

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅ SETUP COMPLETE!                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Project URL : $PROJECT_URL"
echo "  Dashboard   : https://supabase.com/dashboard/project/$PROJECT_REF"
echo "  Env File    : $ENV_FILE"
echo ""
echo "  Environment variables:"
echo "  NEXT_PUBLIC_SUPABASE_URL=$PROJECT_URL"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY"
echo "  SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo ""
echo "  Next steps:"
echo "  1. Configure auth providers at: Authentication → Providers"
echo "  2. Enable Google OAuth if needed"
echo "  3. Deploy your app and test registration/login"
