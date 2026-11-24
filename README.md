# Baby Arrival Pool 2027

## Review the demo

Open **Baby-Arrival-Pool-2027-Preview.html** in Chrome or Edge. Pick a January AM or PM slot, enter a sample name and email such as Alex Taylor and alex@example.com, and save. Choose **Make another prediction** to try the same slot again. Demo submissions stay in the open page session and reset when you reload. Gift collection is disabled and the demo has no database connection.

To regenerate the standalone file after editing the participant interface, run `node scripts/preview.mjs`. To run the full Next.js site locally, install Node.js 22.18 or newer with npm, then run:

```sh
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

Open http://localhost:3000. The application defaults to demo mode. The SQL integration tests in `supabase/tests/pool.sql` require a fresh test database with the migration already applied.

## Set up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com/dashboard). Keep the database password private.
2. Open **SQL Editor**, create a new query, paste the full contents of `supabase/migrations/202611240001_pool.sql`, then select **Run** once.
3. Under **Authentication → Users**, create and confirm each authorized organizer user. Each person should choose a unique, strong password. Copy their UUIDs and disable public sign-ups. Only the UUIDs explicitly listed in ADMIN_USER_IDS receive organizer access.
4. Copy the project URL, the publishable API key, and the server-only secret key. The legacy anon and service_role keys also work in the corresponding fields.

## Deploy on Vercel

1. Put these source files in your GitHub repository. Keep it private if you want to limit source access.
2. At [vercel.com](https://vercel.com/new), import the GitHub repository. Select the **Next.js** preset and Node.js 22.x or newer. If prompted, give Vercel access to the repository.
3. Add the variables below under the project's **Settings → Environment Variables**. Use live credentials for Production only. Preview deployments can use `APP_MODE=demo`. For local live testing, copy `.env.example` to `.env.local` and restart the dev server after editing.

| Variable | Value |
| --- | --- |
| `APP_MODE` | `live` for the private production pool |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase secret or legacy service_role key |
| `ADMIN_USER_IDS` | Comma-separated Supabase UUIDs for the authorized organizers. Unlisted users are denied. |
| `INVITE_TOKEN` | A private, randomly generated secret of at least 32 characters |
| `INTERAC_TRANSFER_EMAIL` | Organizer email for Interac e-Transfer. Set it privately before enabling gifts. |
| `GIFT_COLLECTION_ENABLED` | `false` until applicable requirements and provider policies are confirmed |

Generate the invitation token on your own computer with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep secret values in Vercel or `.env.local`, outside Git.

4. Deploy. Open the home page without an invitation in a private browser window and confirm it asks for one. Send your guests a URL in the format `https://YOUR-VERCEL-DOMAIN/#invite=YOUR-TOKEN`. The link grants access to whoever has it. If you rotate the token, redeploy and share a new link. Existing invitation sessions will need the new link.
5. Visit `https://YOUR-VERCEL-DOMAIN/admin` and sign in. Test invitations, duplicate slot submissions, and CSV on a separate Supabase test project before sharing the production invite. Entering a birth result closes submissions.

## Organizer workflow

- While collection is disabled, invited guests can make free predictions. Entries made during that period have no gift due.
- After confirming applicable requirements and provider policies, change `GIFT_COLLECTION_ENABLED` to `true` and redeploy if you decide to enable collection. New entries then show the organizer's Interac e-Transfer email and an instruction to include the confirmation reference. The application does not initiate transfers.
- Match each transfer in your bank to its reference before clicking **Confirm received**. The dashboard totals confirmed gifts only. Use **Download CSV** for a private export.
- Enter the actual birth date and time as shown on the Toronto clock. The dashboard marks every matching January prediction correct. Midnight is AM and noon is PM. If the birth falls outside January 2027, no January slot matches.
- Keep the export private. It contains participant names, emails and wishes.

See the [Vercel GitHub deployment guide](https://vercel.com/docs/git/vercel-for-github), [Next.js environment variable guide](https://nextjs.org/docs/app/guides/environment-variables), and [Supabase API key guide](https://supabase.com/docs/guides/api/api-keys).


## Confirmation emails and deleting predictions

Apply all numbered SQL migrations in order. Existing projects need both
`supabase/migrations/202611240002_confirmation_email.sql` and
`supabase/migrations/202611240003_delete_prediction.sql` before using the new features.
The existing GitHub Pages demo remains offline and never sends email.

Email is off by default. For production, use a Resend Free account and a verified
sending domain you already control. Set these Vercel **Production only** variables:

| Variable | Value |
| --- | --- |
| `EMAIL_ENABLED` | `true` only after the migration and sender setup are complete |
| `RESEND_API_KEY` | Server-side Resend sending API key; store as a secret |
| `EMAIL_FROM` | Approved sender address on the verified domain |
| `INTERAC_TRANSFER_EMAIL` | Organizer-confirmed e-transfer recipient; independent of sender |
| `GIFT_COLLECTION_ENABLED` | Keep `false` until separately authorized to enable gifts |

Redeploy after changing configuration. Resend requires domain verification for
participant delivery: https://resend.com/docs/dashboard/domains/introduction .
Use only the Free plan and its quotas; do not enable paid overages or upgrades.
If no sending domain is available, leave email disabled pending a provider choice.
Do not use a personal Gmail/Yahoo address as a Resend sender.

Emails contain the selected date/time and confirmation reference. Free submissions
explicitly say no payment is due. E-transfer instructions are included only when
that saved prediction requested a gift, collection is currently enabled, and a
recipient is configured. Sending never marks a gift as received.

The database permanently claims one send attempt per prediction, and the provider
also receives an idempotency key. Repeated/concurrent submissions cannot cause a
second send. Provider acceptance is recorded as `submitted`, not delivery.
Failures or timeouts never cancel a saved prediction. There is no automatic retry:
inspect `prediction_email_delivery` and the provider log before any manual resend,
especially for `unknown`/`claimed` attempts. Do not clear claims to retry blindly.
No email is sent for existing predictions merely by enabling the feature.

The organizer dashboard has a per-row Delete action. It confirms the participant,
slot and reference, permanently deletes only that prediction and its email-attempt
record, then reloads counts and the first page. Both allowlisted organizers can use
it; ordinary authenticated users cannot. There is no bulk-delete endpoint. A
previously sent email cannot be recalled by deleting its prediction.

Verification: `node --test tests/*.test.mjs`, `pnpm run build`, then
`node tests/api.mjs` (local fake Supabase; no real email). Database integration
checks in `supabase/tests/email_delete.sql` require a dedicated test database and
roll back their synthetic records. These SQL checks must be run separately from
local JavaScript checks.
