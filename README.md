# Uceni Games

Educational trivia learning service operated by Venix Partners Limited on shortcode 7995.
Learn. Think. Grow.

## What is in this repository

| Path | What it is |
| --- | --- |
| `index.html`, `js/app.js`, `css/app.css` | The learner web app (HTML5, no build step) |
| `admin/` | Admin portal for question approval, flags, complaints, learners and NCC figures |
| `legal/` | Terms of Service, Privacy Notice and Service Policies |
| `assets/` | Vector logos (wordmark and icon, black and white) |
| `js/config.js` | Public settings: API addresses, publishable key, billing mode |
| `supabase/migrations/` | Database schema and the launch question bank |
| `supabase/functions/uceni-api/` | Learner API: sign in, subscriptions, sessions, scoring |
| `supabase/functions/uceni-admin/` | Admin API |

## How it works

- The site is static and deploys to Vercel straight from this repository.
- All data lives in the `uceni` schema of the Supabase project. The schema is not exposed to the public REST API.
  Every read and write goes through the two edge functions, which connect to the database directly.
- Scoring, timing, streaks and subscription checks all run on the server, so a phone cannot inflate Knowledge Points.

## Test mode

Two things are simulated until the aggregator is connected:

1. **Sign in codes.** The code is shown on screen instead of being sent by SMS.
   Set the edge function secret `UCENI_OTP_MODE=live` once SMS sending is wired in.
2. **Billing.** Subscribe, renew and cancel work end to end and record charges with `provider = 'mock'`.
   The aggregator integration replaces the `subscribe`, `cancel` and renewal logic in `uceni-api`, then
   `billingLive` in `js/config.js` is switched to `true`.

## Deploying changes

- Front end: push to `main` and Vercel deploys automatically.
- Edge functions: `supabase functions deploy uceni-api --no-verify-jwt` and `supabase functions deploy uceni-admin --no-verify-jwt`.
- Database: apply new files in `supabase/migrations/` in order.
