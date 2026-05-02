---
id: webhooks
number: 3
title: Webhooks
description: React to payment events in real time
category: api-reference
categoryTitle: API Reference
---

## Overview

FlowPay POSTs JSON payloads to your configured endpoint when events occur. Your server must respond with `2xx` within 5 seconds, or the delivery is marked as failed and retried.

> **Tip:** Log all incoming webhook payloads during development. A full delivery history makes event-handling bugs much easier to diagnose.

## Webhook events

| Event | Description |
|---|---|
| `charge.created` | A new charge was created |
| `charge.processing` | The charge entered processing |
| `charge.settled` | The charge settled successfully |
| `charge.failed` | The charge failed |
| `refund.created` | A [[link:api-reference/refunds|refund]] was initiated |
| `refund.succeeded` | The refund completed successfully |
| `refund.failed` | The refund failed |

## Payload structure

Every event has the same outer envelope:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique event ID, prefixed `evt_` |
| `type` | string | Event type, e.g. `charge.settled` |
| `created_at` | string | ISO 8601 event timestamp |
| `data` | object | Event-specific payload |

```json
{
  "id": "evt_abc789",
  "type": "charge.settled",
  "created_at": "2025-04-28T10:22:05Z",
  "data": {
    "charge_id": "ch_abc123",
    "amount": 2500,
    "currency": "usd"
  }
}
```

## Verifying signatures

FlowPay signs every webhook request with a secret you configure in the dashboard. Always verify the `X-FlowPay-Signature` header before processing the payload:

```javascript
const crypto = require("crypto");

function verifyWebhook(rawBody, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}
```

> **Warning:** Always verify signatures in production. Skipping this check means anyone can POST fake events to your endpoint.

## Retry schedule

Failed deliveries are retried at increasing intervals:

```
Attempt   Delay after previous
───────   ────────────────────
  1       immediate
  2       5 seconds
  3       30 seconds
  4       5 minutes
  5       30 minutes
  6       2 hours
  7       8 hours
  8       24 hours  ← final attempt
```

After the final attempt the event is marked as abandoned. You can manually replay any event from the dashboard.
