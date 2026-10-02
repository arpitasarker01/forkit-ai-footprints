#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FORKIT_AI_PROJECT_ID:-}"
REGION="${FORKIT_AI_REGION:-europe-west1}"
BILLING_ACCOUNT_ID="${FORKIT_AI_BILLING_ACCOUNT_ID:-}"
SERVICE="forkit-ai-analytics"
REPO="forkit-ai-public"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$PROJECT_ID" ]]; then
  echo "FORKIT_AI_PROJECT_ID is required (use a new project dedicated to forkit-ai.com)." >&2
  exit 2
fi

command -v gcloud >/dev/null || { echo "gcloud is required." >&2; exit 2; }
command -v node >/dev/null || { echo "Node.js is required." >&2; exit 2; }

ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n1)"
[[ -n "$ACCOUNT" ]] || { echo "No active gcloud account. Run: gcloud auth login" >&2; exit 2; }
echo "Using Google account: $ACCOUNT"

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating isolated project $PROJECT_ID..."
  gcloud projects create "$PROJECT_ID" --name="Forkit AI Public"
fi

if [[ "$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null || true)" != "True" ]]; then
  if [[ -z "$BILLING_ACCOUNT_ID" ]]; then
    mapfile -t OPEN_ACCOUNTS < <(gcloud billing accounts list --filter='open=true' --format='value(name)')
    if [[ "${#OPEN_ACCOUNTS[@]}" -ne 1 ]]; then
      echo "Billing is not linked. Set FORKIT_AI_BILLING_ACCOUNT_ID to the intended billing account." >&2
      exit 3
    fi
    BILLING_ACCOUNT_ID="${OPEN_ACCOUNTS[0]}"
  fi
  echo "Linking project to billing account $BILLING_ACCOUNT_ID..."
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
fi

gcloud services enable   firebase.googleapis.com   firebasehosting.googleapis.com   run.googleapis.com   cloudbuild.googleapis.com   artifactregistry.googleapis.com   logging.googleapis.com   --project="$PROJECT_ID"

if ! npx -y firebase-tools@latest projects:list --json | grep -q "\"projectId\":\"$PROJECT_ID\""; then
  npx -y firebase-tools@latest projects:addfirebase "$PROJECT_ID" --non-interactive
fi

if ! gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO"     --repository-format=docker     --location="$REGION"     --description="Forkit AI isolated public website services"     --project="$PROJECT_ID"
fi

IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE:$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo manual)"

gcloud builds submit "$ROOT/analytics-collector"   --project="$PROJECT_ID"   --region="$REGION"   --default-buckets-behavior=regional-user-owned-bucket   --tag="$IMAGE"

gcloud run deploy "$SERVICE"   --project="$PROJECT_ID"   --region="$REGION"   --image="$IMAGE"   --allow-unauthenticated   --min=0   --max=1   --memory=256Mi   --cpu=1   --concurrency=80   --timeout=5s   --set-env-vars=NODE_ENV=production

if ! gcloud logging sinks describe _Default --project="$PROJECT_ID" --format=json | grep -q 'forkit-ai-analytics-request-logs'; then
  gcloud logging sinks update _Default     --project="$PROJECT_ID"     --add-exclusion='name=forkit-ai-analytics-request-logs,description=Drop Cloud Run request metadata for public analytics collector,filter=resource.type="cloud_run_revision" AND resource.labels.service_name="forkit-ai-analytics" AND logName:"run.googleapis.com%2Frequests"'
fi

cd "$ROOT"
npx -y firebase-tools@latest deploy --only hosting --project "$PROJECT_ID" --non-interactive

URL="https://$PROJECT_ID.web.app"
echo "Verifying $URL ..."
curl -fsS "$URL/" >/dev/null
curl -fsS "$URL/footprint/" >/dev/null
curl -fsS "$URL/action-assurance/" >/dev/null
curl -fsS "$URL/how-it-works/" >/dev/null
curl -fsS "$URL/reconstruct/" >/dev/null
curl -fsS "$URL/contact/" >/dev/null

echo
echo "Forkit AI isolated deployment is live:"
echo "$URL"
echo
echo "Next human-only step: attach forkit-ai.com and www.forkit-ai.com in Firebase Hosting and apply the exact DNS records Firebase returns."
