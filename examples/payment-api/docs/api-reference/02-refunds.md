---
id: refunds
number: 2
title: Refunds
description: Reverse settled charges fully or partially
category: api-reference
categoryTitle: API Reference
---

## The Refund object

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier, prefixed `re_` |
| `charge_id` | string | ID of the [[link:api-reference/charges|charge]] being refunded |
| `amount` | integer | Amount refunded in the smallest currency unit |
| `status` | string | `pending`, `succeeded`, or `failed` |
| `reason` | string | `duplicate`, `fraudulent`, or `customer_request` |
| `created_at` | string | ISO 8601 creation timestamp |

## Create a refund

**POST** `/v1/refunds`

Omit `amount` to issue a full refund. Include it to issue a partial refund.

```bash
curl https://api.flowpay.dev/v1/refunds \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "charge_id": "ch_abc123",
    "amount": 1000,
    "reason": "customer_request"
  }'
```

> **Warning:** Partial refunds are permanent. You can issue multiple partial refunds against the same charge as long as the total does not exceed the original charge amount.

## Retrieve a refund

**GET** `/v1/refunds/:id`

```bash
curl https://api.flowpay.dev/v1/refunds/re_xyz456 \
  -H "Authorization: Bearer sk_test_..."
```

## Refund events

When you create a refund, FlowPay fires two [[link:api-reference/webhooks|webhook events]]:

1. `refund.created` — immediately when the refund is initiated
2. `refund.succeeded` or `refund.failed` — once the refund is processed (usually within seconds)
