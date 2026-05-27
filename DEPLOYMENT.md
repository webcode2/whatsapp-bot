# ASK WhatsApp Bot — Deployment Guide

> Complete step-by-step guide for deploying the ASK bot to Google Cloud Functions
> with Firestore, Pub/Sub, Cloud Scheduler, and Twilio.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Google Cloud Project Setup](#2-google-cloud-project-setup)
3. [Firebase Project Setup](#3-firebase-project-setup)
4. [Firestore Database & Indexes](#4-firestore-database--indexes)
5. [Pub/Sub Topics](#5-pubsub-topics)
6. [Twilio WhatsApp Setup](#6-twilio-whatsapp-setup)
7. [Environment & Secrets](#7-environment--secrets)
8. [Build & Deploy](#8-build--deploy)
9. [Twilio Webhook Configuration](#9-twilio-webhook-configuration)
10. [Verify Deployment](#10-verify-deployment)
11. [Architecture Reference](#11-architecture-reference)
12. [Cost Estimation](#12-cost-estimation)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

Install these tools on your local machine before starting:

```bash
# Node.js 20+ (required by Cloud Functions Gen2)
node --version   # Must be >= 20.0.0

# Firebase CLI
npm install -g firebase-tools

# Google Cloud CLI (gcloud)
# https://cloud.google.com/sdk/docs/install
gcloud --version

# Verify yarn is available
yarn --version
```

### Accounts Required

| Service        | URL                                      | Purpose                        |
|----------------|------------------------------------------|--------------------------------|
| Google Cloud   | https://console.cloud.google.com         | Hosting, Firestore, Pub/Sub    |
| Firebase       | https://console.firebase.google.com      | Functions deployment, emulators|
| Twilio         | https://www.twilio.com/console           | WhatsApp messaging API         |

---

## 2. Google Cloud Project Setup

### 2.1 Create a new GCP project

```bash
# Create the project (choose a unique ID)
gcloud projects create ask-bot-prod --name="ASK WhatsApp Bot"

# Set it as your active project
gcloud config set project ask-bot-prod
```

### 2.2 Enable billing

> ⚠️ Cloud Functions, Pub/Sub, and Cloud Scheduler require billing enabled.

1. Go to: https://console.cloud.google.com/billing
2. Link a billing account to `ask-bot-prod`

### 2.3 Enable required APIs

```bash
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  pubsub.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  secretmanager.googleapis.com
```

**What each API does:**

| API                         | Purpose                                                     |
|-----------------------------|-------------------------------------------------------------|
| `cloudfunctions`            | Deploys and runs the Cloud Functions (webhook, workers)     |
| `cloudbuild`                | Builds the function container during deployment             |
| `cloudscheduler`            | Triggers `processMorningDispatch` and `processReminderDispatch` on cron |
| `pubsub`                    | Message queue between dispatchers and workers               |
| `firestore`                 | NoSQL database for user profiles, streaks, journals         |
| `artifactregistry`          | Stores the built container images                           |
| `run`                       | Cloud Functions Gen2 runs on top of Cloud Run               |
| `eventarc`                  | Routes Pub/Sub events to Cloud Functions                    |
| `secretmanager`             | Securely stores Twilio credentials                          |

---

## 3. Firebase Project Setup

### 3.1 Add Firebase to your GCP project

```bash
# Login to Firebase
firebase login

# Add Firebase to the existing GCP project
firebase projects:addfirebase ask-bot-prod

# Set the project as default for this directory
firebase use ask-bot-prod
```

### 3.2 Upgrade to Blaze (pay-as-you-go) plan

1. Go to: https://console.firebase.google.com/project/ask-bot-prod/usage/details
2. Click **Upgrade** → select **Blaze** plan
3. This is required for Cloud Functions deployment (you still get the free tier)

### 3.3 Verify `firebase.json`

The project already has a properly configured `firebase.json`:

```json
{
  "functions": {
    "source": "functions"
  },
  "emulators": { ... }
}
```

No changes needed.

---

## 4. Firestore Database & Indexes

### 4.1 Create the Firestore database

```bash
# Create a Firestore database in Native mode (required, not Datastore mode)
gcloud firestore databases create \
  --location=us-central \
  --type=firestore-native
```

> 📍 Use `us-central` to co-locate with your Cloud Functions region (`us-central1`).

### 4.2 Deploy Firestore composite indexes

The bot uses optimized range queries that require composite indexes. Deploy them:

```bash
firebase deploy --only firestore:indexes
```

This deploys the 3 indexes defined in `firestore.indexes.json`:

| Index                          | Used By                     | Query Pattern                                     |
|--------------------------------|-----------------------------|----------------------------------------------------|
| `paused` + `nextSendAt`       | `processMorningDispatch`    | `where('paused','==',false).where('nextSendAt','<=',now)` |
| `paused` + `nextReminderAt`   | `processReminderDispatch`   | `where('paused','==',false).where('nextReminderAt','<=',now)` |
| `lockedUntil`                  | `reconcileStuckJobs`        | `where('lockedUntil','<=',tenMinutesAgo)`          |

> ⏳ Index creation takes 2–5 minutes. Check status at:
> https://console.firebase.google.com/project/ask-bot-prod/firestore/indexes

### 4.3 (Optional) Add Firestore security rules

For production, create `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only Cloud Functions (admin SDK) can read/write — deny all client access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Deploy:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Pub/Sub Topics

The dispatchers publish messages to Pub/Sub topics. The workers subscribe to them.
Firebase Functions Gen2 auto-creates subscriptions, but you must create the **topics** first.

```bash
# Create the morning devotional fanout topic
gcloud pubsub topics create morning-send-topic

# Create the reminder fanout topic
gcloud pubsub topics create reminder-send-topic
```

### Verify topics exist

```bash
gcloud pubsub topics list
```

Expected output:
```
name: projects/ask-bot-prod/topics/morning-send-topic
name: projects/ask-bot-prod/topics/reminder-send-topic
```

> ℹ️ When you deploy the Cloud Functions, Firebase automatically creates
> push subscriptions that route messages from these topics to `processSendWorker`
> and `processReminderWorker`.

---

## 6. Twilio WhatsApp Setup

### 6.1 Create a Twilio account

1. Sign up at https://www.twilio.com/try-twilio
2. Note your **Account SID** and **Auth Token** from the dashboard

### 6.2 Set up a WhatsApp Sender

**Option A: Twilio Sandbox (for testing)**

1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Follow the instructions to join the sandbox
3. Note the sandbox number (e.g., `+14155238886`)

**Option B: Production WhatsApp Business (for launch)**

1. Go to: https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders
2. Register your business with Meta/WhatsApp
3. Get an approved WhatsApp Business number
4. Create message templates for outbound proactive messages

> ⚠️ **Important**: WhatsApp requires pre-approved **message templates** for any
> message sent outside the 24-hour customer service window. Your morning devotionals
> and reminders are proactive messages, so you MUST create templates in the
> [Twilio Content Template Builder](https://console.twilio.com/us1/develop/sms/content-template-builder).

### 6.3 Collect your Twilio credentials

You need these 3 values:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+14155238886
```

---

## 7. Environment & Secrets

### 7.1 Store secrets in Google Secret Manager

Never hardcode credentials. Use Secret Manager:

```bash
# Store Twilio Account SID
echo -n "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" | \
  gcloud secrets create TWILIO_ACCOUNT_SID --data-file=-

# Store Twilio Auth Token
echo -n "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" | \
  gcloud secrets create TWILIO_AUTH_TOKEN --data-file=-

# Store Twilio WhatsApp number
echo -n "+14155238886" | \
  gcloud secrets create TWILIO_WHATSAPP_NUMBER --data-file=-
```

### 7.2 Grant Cloud Functions access to secrets

```bash
# Get the project number
PROJECT_NUMBER=$(gcloud projects describe ask-bot-prod --format='value(projectNumber)')

# Grant the default compute service account access to secrets
gcloud secrets add-iam-policy-binding TWILIO_ACCOUNT_SID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding TWILIO_AUTH_TOKEN \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding TWILIO_WHATSAPP_NUMBER \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 7.3 Update `firebase.json` to inject secrets

Add the `runWith` secret bindings to your function definitions. This is done in
`index.ts` using the Cloud Functions v2 options. Update the function declarations
to reference secrets (covered in the next section).

Alternatively, set environment variables directly:

```bash
# Set runtime environment config (simpler but less secure)
firebase functions:config:set \
  twilio.account_sid="ACxxxxxxxx" \
  twilio.auth_token="xxxxxxxx" \
  twilio.whatsapp_number="+14155238886"
```

---

## 8. Build & Deploy

### 8.1 Install dependencies and build

```bash
cd functions
yarn install
yarn build
```

Verify no TypeScript errors before deploying.

### 8.2 Deploy all functions

```bash
# From the project root (not functions/)
firebase deploy --only functions
```

This deploys **6 Cloud Functions**:

| Function                  | Trigger          | Purpose                                        |
|---------------------------|------------------|-------------------------------------------------|
| `whatsappWebhook`         | HTTP (onRequest) | Receives inbound WhatsApp messages from Twilio  |
| `processMorningDispatch`  | Scheduler (cron) | Every minute: queries users needing devotionals  |
| `processReminderDispatch` | Scheduler (cron) | Every minute: queries users needing reminders    |
| `reconcileStuckJobs`      | Scheduler (cron) | Every 10 min: cleans up failed execution leases  |
| `processSendWorker`       | Pub/Sub          | Sends the actual devotional via Twilio           |
| `processReminderWorker`   | Pub/Sub          | Sends the actual reminder via Twilio             |

### 8.3 Note your webhook URL

After deployment, Firebase prints the function URLs:

```
✔  functions: whatsappWebhook(us-central1): https://whatsappwebhook-XXXXX-uc.a.run.app
```

**Save this URL** — you'll need it for the Twilio webhook configuration.

### 8.4 Deploy a single function (for updates)

```bash
# Deploy only the webhook function
firebase deploy --only functions:whatsappWebhook

# Deploy only the workers
firebase deploy --only functions:processSendWorker,functions:processReminderWorker
```

---

## 9. Twilio Webhook Configuration

### 9.1 Point Twilio to your Cloud Function

1. Go to: https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders
2. Select your WhatsApp number
3. Under **"When a message comes in"**, set:
   - **URL**: `https://whatsappwebhook-XXXXX-uc.a.run.app/webhook`
   - **Method**: `POST`
4. Click **Save**

### 9.2 For Sandbox testing

1. Go to: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. Under **"WHEN A MESSAGE COMES IN"**, paste your Cloud Function URL
3. Make sure the method is set to `HTTP POST`

---

## 10. Verify Deployment

### 10.1 Check all functions are deployed

```bash
firebase functions:list
```

### 10.2 Test the webhook directly

```bash
# Replace with your actual function URL
WEBHOOK_URL="https://whatsappwebhook-XXXXX-uc.a.run.app"

# Test health check
curl -s "$WEBHOOK_URL/health" | python3 -m json.tool

# Test JOIN keyword
curl -s -X POST "$WEBHOOK_URL/webhook" \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+2348012345678","Body":"JOIN","ProfileName":"TestUser"}' \
  | python3 -m json.tool
```

### 10.3 Check Cloud Scheduler jobs were created

```bash
gcloud scheduler jobs list --location=us-central1
```

Expected output (3 jobs):
```
ID                              LOCATION      SCHEDULE       STATE
firebase-schedule-processMorning... us-central1  * * * * *    ENABLED
firebase-schedule-processReminder.. us-central1  * * * * *    ENABLED
firebase-schedule-reconcileStuck.. us-central1  */10 * * * *  ENABLED
```

### 10.4 Check Pub/Sub subscriptions were created

```bash
gcloud pubsub subscriptions list
```

### 10.5 Check function logs

```bash
# Live tail all function logs
firebase functions:log --only whatsappWebhook

# Or use gcloud for more detail
gcloud functions logs read whatsappWebhook --gen2 --region=us-central1 --limit=50
```

### 10.6 Send a real WhatsApp message

1. Open WhatsApp on your phone
2. Send **JOIN** to your Twilio WhatsApp number
3. You should receive: `Welcome to ASK, [Name]! You've been grafted in...`

---

## 11. Architecture Reference

```
┌──────────────┐    POST     ┌─────────────────────┐
│   WhatsApp   │────────────>│  Twilio             │
│   User       │<────────────│  (WhatsApp API)     │
└──────────────┘   reply     └────────┬────────────┘
                                      │ POST /webhook
                                      ▼
                             ┌─────────────────────┐
                             │  whatsappWebhook     │  ← Cloud Function (HTTP)
                             │  (Express App)       │
                             └────────┬────────────┘
                                      │ reads/writes
                                      ▼
                             ┌─────────────────────┐
                             │  Firestore           │  ← users, journals, streaks
                             └────────┬────────────┘
                                      │
    ┌─────────────────────────────────┼──────────────────────────────┐
    │                                 │                              │
    ▼                                 ▼                              ▼
┌───────────────────┐  ┌──────────────────────┐  ┌─────────────────────────┐
│ processMorning    │  │ processReminder      │  │ reconcileStuckJobs      │
│ Dispatch          │  │ Dispatch             │  │                         │
│ (Cron: * * * * *) │  │ (Cron: * * * * *)   │  │ (Cron: */10 * * * *)   │
└────────┬──────────┘  └────────┬─────────────┘  └─────────────────────────┘
         │ publish               │ publish
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ morning-send    │     │ reminder-send    │       ← Pub/Sub Topics
│ -topic          │     │ -topic           │
└────────┬────────┘     └────────┬─────────┘
         │ subscribe             │ subscribe
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ processSend     │     │ processReminder  │       ← Cloud Functions (Pub/Sub)
│ Worker          │     │ Worker           │
└────────┬────────┘     └────────┬─────────┘
         │ send msg              │ send msg
         ▼                       ▼
┌──────────────────────────────────────────┐
│              Twilio API                  │       ← Outbound WhatsApp messages
└──────────────────────────────────────────┘
```

---

## 12. Cost Estimation

For **200k users** with daily devotionals and reminders:

| Service            | Free Tier                | Est. Monthly Cost (200k users) |
|--------------------|--------------------------|-------------------------------|
| Cloud Functions    | 2M invocations/month     | ~$5–15                        |
| Cloud Scheduler    | 3 free jobs              | $0 (we use exactly 3)        |
| Firestore          | 50k reads, 20k writes/day| ~$15–30                       |
| Pub/Sub            | 10GB/month free          | ~$2–5                         |
| Secret Manager     | 10k accesses/month free  | $0                            |
| Twilio WhatsApp    | —                        | ~$0.005/msg × 400k = ~$2,000 |

> 💡 The largest cost by far is **Twilio messaging**. Infrastructure costs for
> Google Cloud at this scale are negligible compared to SMS/WhatsApp delivery fees.

---

## 13. Troubleshooting

### "No valid functions configuration detected in firebase.json"

Ensure `firebase.json` has:
```json
{
  "functions": {
    "source": "functions"
  }
}
```

### "runtime field is required"

Add `"engines"` to `functions/package.json`:
```json
{
  "engines": {
    "node": "20"
  }
}
```

### Cloud Scheduler jobs not created

Cloud Scheduler requires an App Engine app in your project:
```bash
gcloud app create --region=us-central
```

### Pub/Sub permission denied

Grant the Pub/Sub service account the invoker role:
```bash
PROJECT_NUMBER=$(gcloud projects describe ask-bot-prod --format='value(projectNumber)')

gcloud projects add-iam-policy-binding ask-bot-prod \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### Firestore index errors

If you see `FAILED_PRECONDITION: The query requires an index`, redeploy indexes:
```bash
firebase deploy --only firestore:indexes
```

### Function timeout on large user base

Increase the timeout for dispatchers:
```typescript
export const processMorningDispatch = onSchedule(
  { schedule: '* * * * *', timeoutSeconds: 540 },
  async (event) => { ... }
);
```

---

## Quick Deploy Checklist

```
[ ] 1. gcloud project created & billing enabled
[ ] 2. All GCP APIs enabled (Step 2.3)
[ ] 3. Firebase added to project & Blaze plan active
[ ] 4. Firestore database created in Native mode
[ ] 5. Firestore indexes deployed
[ ] 6. Pub/Sub topics created (morning-send-topic, reminder-send-topic)
[ ] 7. Twilio account set up with WhatsApp sender
[ ] 8. Secrets stored in Secret Manager
[ ] 9. `yarn build` succeeds with no errors
[ ] 10. `firebase deploy --only functions` succeeds
[ ] 11. Twilio webhook URL pointed to Cloud Function
[ ] 12. Sent test "JOIN" message from WhatsApp
[ ] 13. Verified Cloud Scheduler jobs are running
[ ] 14. Checked function logs for errors
```
