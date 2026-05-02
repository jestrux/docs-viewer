---
id: intro
number: 1
title: Introduction
description: What FlowPay is and how it works
category: overview
categoryTitle: Overview
---

## What is FlowPay

FlowPay is a developer-first payments API. Accept money, issue refunds, and react to payment events in real time — with a single HTTP integration.

A charge is created on your server, never from the client. The client never touches your API keys.

## Payment flow

```
Client          Your Server         FlowPay API
  │                  │                    │
  │── checkout ─────▶│                    │
  │                  │── POST /charges ──▶│
  │                  │◀── charge object ──│
  │◀── charge.id ────│                    │
  │                  │                    │
  ╌                  ╌                    ╌
  │                  │◀── webhook ────────│
  │                  │    (charge.settled)│
  │                  │── 200 OK ─────────▶│
```

> **Concept:** FlowPay follows a server-side model. All sensitive operations happen between your server and the API — your client only ever receives a charge ID.

## Core objects

- **Charge** — a payment attempt. Status moves from `pending` → `processing` → `settled` or `failed`.
- **Refund** — created against a settled [[link:api-reference/charges|charge]]. Partial or full.
- **PaymentMethod** — a card or bank account attached to a customer.
- **Webhook** — an event notification POSTed to your server when something changes.

## Key principles

- **Idempotency** — every mutating request accepts an `Idempotency-Key` header. Safe to retry on network failure without double-charging.
- **Event-driven** — don't poll for status. Subscribe to [[link:api-reference/webhooks|webhook events]] instead.
- **Test mode** — use `sk_test_` keys to simulate charges, failures, and refunds without moving real money.
- **Atomic refunds** — a refund either fully succeeds or is never applied. No partial application on error.
