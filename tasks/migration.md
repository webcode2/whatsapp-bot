# Architecture Migration & Implementation Roadmap

This document outlines the roadmap for transitioning the conceptual monolithic architecture to the distributed microservices architecture for the ASK bot.

## Core Rules Checklist (Must Be Verified for Each Boundary)
- [ ] Ensure Blast Radius Control (No shared logic between worker and HTTP layers).
- [ ] Implement Circuit Breakers / Retry Policies.
- [ ] Add Observability (Structured logging using Pino).
- [ ] Test for Partial Failure handling.

## Service Boundaries

### 1. HTTP Webhook Gateway (Boundary: Twilio -> System)
- [ ] **Objective:** Fast, stateless routing of incoming messages.
- [ ] **Tasks:**
  - [ ] Implement `whatsappWebhook` Cloud Function.
  - [ ] Implement `fuzzyMatchService` for routing.
  - [ ] Implement user lookup and session state resolution (`journalService` state).
  - [ ] Ensure no direct database mutations here if asynchronous execution is preferred (or minimal synchronous writes like adding a journal).
- [ ] **Verification:** Load test webhook endpoint; verify response times < 200ms.

### 2. Job Dispatcher Services (Boundary: Scheduler -> Pub/Sub)
- [ ] **Objective:** Fan-out scheduled tasks without direct sending.
- [ ] **Tasks:**
  - [ ] Implement `processMorningDispatch` scheduler function.
  - [ ] Implement `processReminderDispatch` scheduler function.
  - [ ] Implement Firestore lease claiming (`executionLease` utility).
- [ ] **Verification:** Verify jobs are published to `PUBSUB_TOPIC_MORNING_SEND` and `PUBSUB_TOPIC_REMINDER_SEND` with `lockedUntil` set correctly in Firestore.

### 3. Worker Services (Boundary: Pub/Sub -> Twilio)
- [ ] **Objective:** Reliable delivery of WhatsApp messages.
- [ ] **Tasks:**
  - [ ] Implement `processSendWorker` function.
  - [ ] Implement `processReminderWorker` function.
  - [ ] Implement robust error handling (e.g., catching Twilio rate limits).
  - [ ] After successful send, update `nextSendAt` / `nextReminderAt` and release `lockedUntil`.
- [ ] **Verification:** Simulate Twilio failure and verify the lease is cleared so the job can be retried.

### 4. Self-Healing & Maintenance Service
- [ ] **Objective:** Recover stuck processes.
- [ ] **Tasks:**
  - [ ] Implement `reconcileStuckJobs` to reset `lockedUntil` where locks are stale (> 10 mins).
- [ ] **Verification:** Create dummy stuck documents and run the reconciler to confirm they are cleared.

## Verification & Observability Checklist
- [ ] All functions use `pino` for structured logging.
- [ ] Timezone computations use UTC exclusively.
- [ ] No generic catch-all errors; use custom error classes.
- [ ] Full Jest test suite passing for critical utility flows.
