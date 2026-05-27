# ASK Devotional Chatbot Backend

This is the distributed microservices backend for the ASK ("Ask, Seek, Knock") Devotional Chatbot built with Node.js, TypeScript, Google Cloud Functions Gen 2, Firebase Firestore, and Google Pub/Sub.

## Architecture
- **Webhook Gateway**: Fast, stateless routing of Twilio messages.
- **Job Dispatchers**: Cloud Schedulers query Firestore for due jobs and publish tasks to Pub/Sub.
- **Workers**: Listen to Pub/Sub topics and execute Twilio sending.
- **Execution Lease**: Uses Firestore transactions (`lockedUntil`) to ensure idempotency.

## Local Setup

### 1. Requirements
- Node.js 20+
- Yarn (`npm install -g yarn`)
- Docker & Docker Compose
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Environment Variables
Copy `.env.example` to `.env` in the `functions/` directory and fill in your keys:
```bash
cp functions/.env.example functions/.env
```

### 3. Install Dependencies
```bash
cd functions
yarn install
```

### 4. Local Development (Firebase Emulators via Docker)
We use Docker to run the Firebase emulators (Firestore, Functions, Pub/Sub).
Ensure Docker is running, then start the emulators:
```bash
docker-compose up --build
```
This will start:
- Emulator UI: http://localhost:4000
- Functions: http://localhost:5001
- Firestore: http://localhost:8080

### 5. Running Tests
```bash
cd functions
yarn test
```

## Deployment

1. **Login to Firebase**:
```bash
firebase login
```

2. **Set the active project**:
```bash
firebase use your-project-id
```

3. **Deploy the Firebase infrastructure (Functions, Indexes)**:
```bash
cd functions
yarn build
cd ..
firebase deploy
```

## Twilio Setup
1. Go to Twilio Console.
2. Navigate to WhatsApp Sender settings.
3. Set the Webhook URL for incoming messages to your deployed Cloud Function URL (e.g. `https://us-central1-demo-ask-bot.cloudfunctions.net/whatsappWebhook`).
