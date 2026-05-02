---
id: authentication
number: 1
title: Authentication
description: API keys, test mode, and keeping secrets safe
category: guides
categoryTitle: Guides
---

## API keys

FlowPay authenticates all requests using API keys. You have two sets — test and live — each available from your dashboard.

| Key prefix | Environment | Charges real money |
|---|---|---|
| `sk_test_` | Test | No |
| `sk_live_` | Live | Yes |

> **Warning:** Never expose your secret key in client-side code or commit it to version control. If a key is ever compromised, rotate it immediately from the dashboard.

## Making authenticated requests

Pass your secret key as a Bearer token in every request:

```bash
curl https://api.flowpay.dev/v1/charges \
  -H "Authorization: Bearer sk_test_your_key_here" \
  -H "Content-Type: application/json"
```

## Test cards

In test mode, use these card numbers to simulate different outcomes. Any future expiry date and any 3-digit CVC work.

| Card number | Outcome |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Expired card |

> **Tip:** Test mode webhooks fire the same events as live mode. Wire up your [[link:api-reference/webhooks|webhook handler]] in test mode before going live.

## Rate limits

The API allows 100 requests per second per key. Exceeding this returns a `429 Too Many Requests`. Responses include `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers so you can back off gracefully.
