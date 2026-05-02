---
id: quickstart
number: 2
title: Quick Start
description: Create your first charge in under five minutes
category: guides
categoryTitle: Guides
---

## Create your first charge

Make sure you have a test API key from the dashboard. Then create a charge:

```bash
curl https://api.flowpay.dev/v1/charges \
  -H "Authorization: Bearer sk_test_your_key_here" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-1234" \
  -d '{
    "amount": 2500,
    "currency": "usd",
    "description": "Order #1234",
    "payment_method": "pm_card_visa"
  }'
```

A successful response:

```json
{
  "id": "ch_abc123",
  "object": "charge",
  "amount": 2500,
  "currency": "usd",
  "status": "settled",
  "description": "Order #1234",
  "created_at": "2025-04-28T10:22:00Z",
  "settled_at": "2025-04-28T10:22:03Z"
}
```

## Listen for the webhook

After a charge settles, FlowPay POSTs a `charge.settled` event to your endpoint:

```json
{
  "id": "evt_xyz789",
  "type": "charge.settled",
  "created_at": "2025-04-28T10:22:05Z",
  "data": {
    "charge_id": "ch_abc123",
    "amount": 2500,
    "currency": "usd"
  }
}
```

> **Note:** Register your webhook endpoint in the dashboard before going live. See [[link:api-reference/webhooks|Webhooks]] for the full event reference and signature verification.

## Issue a refund

If you need to reverse a charge, POST to `/v1/refunds`:

```bash
curl https://api.flowpay.dev/v1/refunds \
  -H "Authorization: Bearer sk_test_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "charge_id": "ch_abc123",
    "amount": 2500,
    "reason": "customer_request"
  }'
```

## What's next

- Read the full [[link:api-reference/charges|Charges]] reference for all request parameters and status transitions.
- Learn how to verify [[link:api-reference/webhooks|webhook signatures]] to protect your endpoint.
