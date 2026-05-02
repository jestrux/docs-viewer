---
id: charges
number: 1
title: Charges
description: Create and manage payment charges
category: api-reference
categoryTitle: API Reference
---

## The Charge object

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier, prefixed `ch_` |
| `amount` | integer | Amount in the smallest currency unit (e.g. cents for USD) |
| `currency` | string | ISO 4217 currency code, e.g. `usd` |
| `status` | string | `pending`, `processing`, `settled`, `failed`, or `refunded` |
| `description` | string | Optional human-readable description shown on receipts |
| `payment_method` | string | ID of the PaymentMethod used |
| `idempotency_key` | string | Client-supplied deduplication key |
| `metadata` | object | Arbitrary key-value pairs you can attach for your own use |
| `created_at` | string | ISO 8601 creation timestamp |
| `settled_at` | string | ISO 8601 settlement timestamp. `null` until settled |

## Create a charge

**POST** `/v1/charges`

```bash
curl https://api.flowpay.dev/v1/charges \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-5678" \
  -d '{
    "amount": 4999,
    "currency": "usd",
    "payment_method": "pm_card_visa",
    "description": "Pro plan — April 2025",
    "metadata": { "order_id": "5678" }
  }'
```

> **Concept:** Amount is always in the smallest unit of the currency. For USD, `4999` = $49.99. For JPY (zero-decimal), `4999` = ¥4999.

## Status lifecycle

```
pending → processing → settled
                    ↘ failed

settled → refunded  (via POST /v1/refunds)
```

> **Note:** A charge cannot be [[link:api-reference/refunds|refunded]] until its status is `settled`. Attempting to refund a `processing` charge returns `422 Unprocessable Entity`.

## Retrieve a charge

**GET** `/v1/charges/:id`

```bash
curl https://api.flowpay.dev/v1/charges/ch_abc123 \
  -H "Authorization: Bearer sk_test_..."
```

## List charges

**GET** `/v1/charges`

| Parameter | Type | Description |
|---|---|---|
| `limit` | integer | Number of results (default `20`, max `100`) |
| `starting_after` | string | Cursor for pagination — ID of the last item on the previous page |
| `status` | string | Filter by status |
| `created_after` | string | ISO 8601 timestamp lower bound |

```bash
curl "https://api.flowpay.dev/v1/charges?limit=10&status=settled" \
  -H "Authorization: Bearer sk_test_..."
```
