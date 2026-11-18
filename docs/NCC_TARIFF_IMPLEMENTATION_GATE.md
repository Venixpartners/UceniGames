# Uceni Games: NCC tariff implementation gate

Source of truth: NCC approval dated **2 October 2026**, shortcode **7995**, product **UCENI GAMES**.

## Phase 1 foundation (this PR)

- Add `uceni.approved_tariffs` with all six NCC prices and minute-precision durations.
- Do not replace the legacy `uceni.plans` table yet. It has a non-null whole-day `days` field and supports only daily/weekly/monthly; inserting the short passes there would lead to wrong expiry calculation.
- `available_for_sale` defaults to false for all six catalogue rows. No charge, callback, session permission or frontend purchase button is created by this migration.
- Store `renewal_requires_consent=true` for every entry as a safety rule. A subscription plan's renewal rules must be verified with each operator and the NCC approval before implementing recurring billing.
- Mark the longer plans as *free-trial candidates* rather than granting a trial. The letter states **one-day free trial for new subscription**; subscriber eligibility, trial-to-paid consent and network charging mechanisms require confirmation.

## Approved catalogue

| Code | Price | Access | Type |
| --- | ---: | ---: | --- |
| pass_4h | ₦10 | 240 minutes | fixed duration |
| pass_8h | ₦30 | 480 minutes | fixed duration |
| pass_12h | ₦50 | 720 minutes | fixed duration |
| daily | ₦200 | 1,440 minutes | subscription/on demand |
| weekly | ₦1,000 | 10,080 minutes | subscription/on demand |
| monthly | ₦2,000 | 43,200 minutes | subscription/on demand |

The approval describes a 30-day monthly subscription, so 43,200 minutes are used. A successful paid entitlement must use network-confirmed payment and an explicit expiry timestamp, not simply `days` set by a browser.

## Next implementation PRs — must pass before launch

1. Build a verified SMS OTP flow and disable direct phone-number login. Never release OTPs to the browser in production.
2. Add consent records with tariff, network, consent text/version, time and operator transaction identifiers.
3. Implement one-time trial eligibility and explicit post-trial opt-in. No paid charge merely because a trial elapsed.
4. Replace mock `subscribe`, `cancel` and `access` renewal behaviour with provider-confirmed subscription and entitlement events. Use idempotent, signed callbacks; no synthetic charges.
5. Add all six plans in the UI with the correct access length and tariff. Present cancellation and renewal rules before opt-in.
6. Reconcile carrier/aggregator transactions and add dispute handling, audit logs and receipts.
7. Test on isolated staging; gate production promotion on operator sign-off and documented regulatory launch status.

## Safe staging verification (read-only)

```sql
select tariff_code, amount_ngn, access_minutes, plan_type,
       renewal_requires_consent, free_trial_candidate, available_for_sale
from uceni.approved_tariffs order by access_minutes;

select count(*) as expected_six
from uceni.approved_tariffs
where tariff_code in ('pass_4h','pass_8h','pass_12h','daily','weekly','monthly');
```

Expected: 6 rows, each unavailable for sale; no existing `uceni.plans`, `uceni.charges` or `uceni.subscriptions` records are changed.

## Deployment restrictions

**Do not apply the migration to the production Supabase database as part of this draft PR.**
Apply to an isolated staging branch first, verify SQL, and confirm no unrelated services sharing the Venix Platform database are affected.
Do not merge until reviewed. The NCC letter's 60-day launch provision requires urgent clarification but does not justify bypassing subscriber consent or making mock billing live.
