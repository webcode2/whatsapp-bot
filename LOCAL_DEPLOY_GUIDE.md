# 🚀 ASK WhatsApp Bot — Local Deployment Guide

Complete step-by-step guide to deploy the bot from a fresh machine to a fully running GCP environment.

---

## Prerequisites

Make sure the following are installed before starting:

| Tool | Install | Version Check |
|------|---------|---------------|
| Node.js 22 | [nodejs.org](https://nodejs.org) | `node --version` |
| Yarn | `npm install -g yarn` | `yarn --version` |
| Google Cloud SDK | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) | `gcloud --version` |
| Git | System package manager | `git --version` |

---

## Step 1 — Authenticate with Google Cloud

```bash
# Login with your Google account (opens browser)
gcloud auth login

# Confirm you are authenticated as the right account
gcloud auth list
```

Expected output:
```
ACTIVE  ACCOUNT
*       saviorisrael@gmail.com
```

---

## Step 2 — Set the Active GCP Project

```bash
# Set the project explicitly
gcloud config set project whatapp-497611

# Verify
gcloud config get-value project
```

Expected output: `whatapp-497611`

---

## Step 3 — Clone the Repository

```bash
git clone <your-repo-url>
cd whatsappBot
```

---

## Step 4 — Configure Environment Variables

Copy the example file and fill in your real values:

```bash
cp functions/.env.example functions/.env
```

Edit `.env` in the **project root** with the following values:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886

FIREBASE_PROJECT_ID=whatapp-497611
GOOGLE_CLOUD_PROJECT=whatapp-497611

PUBSUB_TOPIC_MORNING_SEND=morning-send-topic
PUBSUB_TOPIC_REMINDER_SEND=reminder-send-topic
PUBSUB_TOPIC_BIBLE_SEND=365-366-days-bible-challenge
```

> **Where to find Twilio credentials:**
> 1. Go to [console.twilio.com](https://console.twilio.com)
> 2. Select the correct account/subaccount from the top dropdown
> 3. On the Account Dashboard, copy the **Account SID** and reveal the **Auth Token**
> 4. Do NOT use API Keys — use the main dashboard credentials only

### Validate Twilio credentials before proceeding:

```bash
SID=$(grep '^TWILIO_ACCOUNT_SID=' .env | cut -d'=' -f2 | tr -d '[:space:]')
TOKEN=$(grep '^TWILIO_AUTH_TOKEN=' .env | cut -d'=' -f2 | tr -d '[:space:]')

curl -s -u "$SID:$TOKEN" "https://api.twilio.com/2010-04-01/Accounts/$SID.json" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print('✅ VALID:', d['friendly_name']) if 'friendly_name' in d else print('❌ INVALID:', d.get('message'))"
```

Expected output: `✅ VALID: whatsappBot`

---

## Step 5 — Store Secrets in GCP Secret Manager

> **Never hardcode secrets in deploy commands. Store them in Secret Manager once, then all functions pull from there automatically.**

```bash
# Store Twilio credentials (reads from your .env)
SID=$(grep '^TWILIO_ACCOUNT_SID=' .env | cut -d'=' -f2 | tr -d '[:space:]')
TOKEN=$(grep '^TWILIO_AUTH_TOKEN=' .env | cut -d'=' -f2 | tr -d '[:space:]')
NUMBER=$(grep '^TWILIO_WHATSAPP_NUMBER=' .env | cut -d'=' -f2 | tr -d '[:space:]')

# Creates or updates each secret
for SECRET_NAME in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_NUMBER; do
  VALUE="${!SECRET_NAME}"
  if gcloud secrets describe "$SECRET_NAME" > /dev/null 2>&1; then
    echo -n "$VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=-
  else
    echo -n "$VALUE" | gcloud secrets create "$SECRET_NAME" --data-file=- --replication-policy=automatic
  fi
done
```

---

## Step 6 — Build the TypeScript Source

```bash
cd functions

# Install all dependencies (including TypeScript)
yarn install --ignore-engines

# Compile TypeScript → lib/
npx tsc

# Verify compiled output exists
ls lib/
# Expected: handlers  index.js  server.js  services  tests  utils

cd ..
```

---

## Step 7 — Run the Deployment Script

```bash
# Make the script executable (first time only)
chmod +x deploy.sh

# Run the full deployment
./deploy.sh
```

This script will:
- ✅ Enable required GCP APIs
- ✅ Grant IAM permissions for Secret Manager access
- ✅ Create all 5 Pub/Sub topics
- ✅ Create Firestore composite indexes
- ✅ Deploy 5 Cloud Functions (Gen 2)
- ✅ Create/update 3 Cloud Scheduler cron jobs

Expected final output:
```
✅ Deployment complete!
Webhook URL (paste into Twilio):
  https://us-central1-whatapp-497611.cloudfunctions.net/whatsappWebhook
```

---

## Step 8 — Verify All Functions Are Deployed

```bash
gcloud functions list --region=us-central1
```

Expected output — all 5 functions showing `ACTIVE`:

```
NAME                    STATE   TRIGGER         REGION
whatsappWebhook         ACTIVE  HTTP            us-central1
processMorningDispatch  ACTIVE  EVENT_TRIGGER   us-central1
processReminderDispatch ACTIVE  EVENT_TRIGGER   us-central1
processSendWorker       ACTIVE  EVENT_TRIGGER   us-central1
processReminderWorker   ACTIVE  EVENT_TRIGGER   us-central1
reconcileStuckJobs      ACTIVE  EVENT_TRIGGER   us-central1
```

---

## Step 9 — Verify Cloud Schedulers Are Running

```bash
gcloud scheduler jobs list --location=us-central1
```

Expected output — all 3 jobs showing `ENABLED`:

```
ID                        LOCATION     SCHEDULE        STATE
processMorningDispatchJob us-central1  * * * * *       ENABLED
processReminderDispatchJob us-central1 * * * * *       ENABLED
reconcileStuckJobsJob     us-central1  */10 * * * *    ENABLED
```

---

## Step 10 — Verify the Webhook is Responding

```bash
curl -s https://us-central1-whatapp-497611.cloudfunctions.net/whatsappWebhook/health
```

Expected output:
```json
{"status":"ok","service":"ASK WhatsApp Bot"}
```

### Test an inbound message end-to-end:

```bash
curl -s -X POST https://us-central1-whatapp-497611.cloudfunctions.net/whatsappWebhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "From=whatsapp:+2348000000000" \
  --data-urlencode "Body=ask" \
  --data-urlencode "ProfileName=TestUser"
```

Expected output (production mode, not demo):
```json
{"status":"ok","action":"routed"}
```

---

## Step 11 — Configure Twilio Sandbox Webhook

1. Go to **[console.twilio.com](https://console.twilio.com)**
2. Navigate to: **Messaging → Try it out → Send a WhatsApp message → Sandbox settings**
3. Set **"When a message comes in"** to:
   ```
   https://us-central1-whatapp-497611.cloudfunctions.net/whatsappWebhook
   ```
4. Set the method to **`HTTP POST`**
5. Click **Save**

---

## Step 12 — Monitor Live Logs

### Stream logs in real time as messages arrive:

```bash
gcloud logging tail \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="whatsappwebhook"' \
  --project=whatapp-497611
```

### Check the last 20 log entries:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="whatsappwebhook"' \
  --project=whatapp-497611 --limit=20 \
  --format="json" | python3 -c "
import sys, json
for l in json.load(sys.stdin):
    p = l.get('jsonPayload', {})
    print(l['timestamp'][:19], '|', p.get('msg',''), '|', p.get('err', {}).get('message',''))
"
```

### Check scheduler execution history:

```bash
gcloud logging read \
  'resource.type="cloud_scheduler_job"' \
  --project=whatapp-497611 --limit=10 \
  --format="table(timestamp,jsonPayload.@type)"
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Authenticate` | Wrong Twilio credentials | Re-validate SID+Token from Twilio dashboard. Check you're on the right subaccount. |
| `404` on webhook | Express route missing | Ensure `POST /` is registered in `createApp()` in `webhook.ts` |
| `demo_mode` response | `FIREBASE_PROJECT_ID` not set | Add `FIREBASE_PROJECT_ID=whatapp-497611` to `--set-env-vars` in deploy command |
| `Permission denied on secret` | IAM not set | Run: `gcloud projects add-iam-policy-binding whatapp-497611 --member="serviceAccount:112860098691-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"` |
| `index required` Firestore | Missing composite index | Indexes are created by `deploy.sh`. Allow 5-10 min to build. |
| `ch: command not found` in deploy.sh | Cron expression glob expansion | Use single quotes around cron strings: `'*/10 * * * *'` |

---

## Redeployment (after code changes)

```bash
# 1. Rebuild TypeScript
cd functions && npx tsc && cd ..

# 2. Redeploy all functions
./deploy.sh

# OR redeploy only the webhook (faster):
gcloud functions deploy whatsappWebhook \
    --gen2 --region=us-central1 --runtime=nodejs22 \
    --source="$(pwd)/functions" --entry-point=whatsappWebhook \
    --trigger-http --allow-unauthenticated \
    --set-env-vars=PUBSUB_TOPIC_MORNING_SEND=morning-send-topic,PUBSUB_TOPIC_REMINDER_SEND=reminder-send-topic,GOOGLE_CLOUD_PROJECT=whatapp-497611,FIREBASE_PROJECT_ID=whatapp-497611 \
    --set-secrets=TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_WHATSAPP_NUMBER=TWILIO_WHATSAPP_NUMBER:latest
```

---

## Force Restart (without redeploying code)

Use this to pick up new secret versions without a full redeploy:

```bash
gcloud run services update whatsappwebhook \
  --region=us-central1 \
  --update-env-vars=RESTART_TS=$(date +%s)
```

---

*Last updated: 2026-05-28 | Project: whatapp-497611 | Region: us-central1*
