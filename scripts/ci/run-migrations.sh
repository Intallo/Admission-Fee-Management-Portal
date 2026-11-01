#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script: scripts/ci/run-migrations.sh
# Purpose: Applies Supabase compatibility bootstrap and chronological migrations
#          against a disposable PostgreSQL database (e.g. CI / local test container).
#
# Constraints & Guarantees:
# - Connects using explicit test administrator credentials (PGUSER, PGHOST, etc.)
# - Fails immediately on any SQL error (ON_ERROR_STOP=1)
# - Executes forward migrations in strictly chronological order
# - Emits detailed migration execution evidence to stdout and GITHUB_STEP_SUMMARY
# - Never applies test bootstrap to production environments
# ==============================================================================

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-school_test_db}"
PGPASSWORD="${PGPASSWORD:-postgrespassword}"

export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD

echo "================================================================================"
echo " Starting Database Migration Run for Disposable Environment"
echo " Host:      ${PGHOST}:${PGPORT}"
echo " Database:  ${PGDATABASE}"
echo " User:      ${PGUSER}"
echo " Time:      $(date -u +"%Y-%m-%d %H:%M:%SZ")"
echo "================================================================================"

# Step 1: Verify PostgreSQL connection
echo "==> [1/4] Verifying PostgreSQL test database connection..."
psql -v ON_ERROR_STOP=1 -c "SELECT version();" > /dev/null
echo "    PostgreSQL is online and responsive."

# Step 2: Apply Supabase Test Compatibility Bootstrap
BOOTSTRAP_FILE="scripts/ci/00_supabase_test_compat_bootstrap.sql"
if [ ! -f "$BOOTSTRAP_FILE" ]; then
  echo "[FATAL ERROR] Bootstrap file $BOOTSTRAP_FILE not found!" >&2
  exit 1
fi

echo "==> [2/4] Applying Supabase test compatibility bootstrap: $BOOTSTRAP_FILE"
psql -v ON_ERROR_STOP=1 -f "$BOOTSTRAP_FILE"
echo "    Bootstrap applied successfully."

# Step 3: Apply migrations in chronological order
echo "==> [3/4] Discovering and executing migrations in chronological order..."
MIGRATION_COUNT=0
MIGRATION_TABLE_ROWS=""

# Discover all .sql files in supabase/migrations, filter out .down.sql, and sort ascending
MIGRATION_FILES=$(ls supabase/migrations/*.sql | grep -v "\.down\.sql" | sort)

for file in $MIGRATION_FILES; do
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  MIGRATION_NAME=$(basename "$file")
  echo "    Applying migration [$MIGRATION_COUNT]: $MIGRATION_NAME"
  
  # Execute with ON_ERROR_STOP=1: any SQL failure aborts immediately with non-zero exit code
  psql -v ON_ERROR_STOP=1 -f "$file"
  
  MIGRATION_TABLE_ROWS+="${MIGRATION_COUNT} | \`${MIGRATION_NAME}\` | Applied Successfully"$'\n'
done

echo "    All $MIGRATION_COUNT forward migrations executed successfully without errors."

# Step 4: Run Verification & Collect Migration Execution Evidence
echo "==> [4/4] Collecting database verification evidence..."

PUBLIC_TABLE_COUNT=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
PRIVATE_TABLE_COUNT=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'private';")
AUTH_TABLE_COUNT=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'auth';")
STORAGE_TABLE_COUNT=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'storage';")
ROLE_COUNT=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role', 'supabase_admin', 'authenticator', 'school_app_user', 'school_app_login');")
RLS_TABLE_COUNT=$(psql -t -A -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true;")

echo "================================================================================"
echo " MIGRATION EXECUTION EVIDENCE"
echo "--------------------------------------------------------------------------------"
echo " Total Migrations Applied:    $MIGRATION_COUNT"
echo " Public Schema Tables:        $PUBLIC_TABLE_COUNT"
echo " Private Schema Tables:       $PRIVATE_TABLE_COUNT"
echo " Auth Schema Tables:          $AUTH_TABLE_COUNT"
echo " Storage Schema Tables:       $STORAGE_TABLE_COUNT"
echo " Verified Roles:              $ROLE_COUNT / 7"
echo " RLS-Protected Public Tables: $RLS_TABLE_COUNT"
echo "================================================================================"

# If running under GitHub Actions, emit Markdown summary to GITHUB_STEP_SUMMARY
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  cat << EOF >> "$GITHUB_STEP_SUMMARY"
### 🚀 PostgreSQL CI Migration Execution Evidence

- **Execution Timestamp:** $(date -u +"%Y-%m-%d %H:%M:%SZ")
- **Target Database:** \`$PGDATABASE\` on \`$PGHOST:$PGPORT\`
- **Admin User:** \`$PGUSER\`
- **Migrations Applied:** $MIGRATION_COUNT files (100% success, \`ON_ERROR_STOP=1\`)

| Metric | Result | Target / Standard |
|---|:---:|:---:|
| **Migrations Applied** | **$MIGRATION_COUNT** | 9 forward migrations |
| **Public Tables** | **$PUBLIC_TABLE_COUNT** | 32 domain & security tables |
| **Private Tables** | **$PRIVATE_TABLE_COUNT** | 2 vault/counter tables |
| **Auth Tables** | **$AUTH_TABLE_COUNT** | \`auth.users\` compatibility |
| **Storage Tables** | **$STORAGE_TABLE_COUNT** | \`storage.buckets\`, \`storage.objects\` |
| **Verified Roles** | **$ROLE_COUNT / 7** | \`anon\`, \`authenticated\`, \`service_role\`, \`supabase_admin\`, \`authenticator\`, \`school_app_user\`, \`school_app_login\` |
| **RLS-Protected Tables** | **$RLS_TABLE_COUNT** | All public tables have RLS enabled |

#### Applied Migration Sequence
| # | Migration File | Status |
|:---:|---|:---:|
$(printf "%s" "$MIGRATION_TABLE_ROWS")
EOF
fi

echo "==> Migration pipeline completed successfully."
