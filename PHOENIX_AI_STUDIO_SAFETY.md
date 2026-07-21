# Phoenix AI Studio Safety Rules

This file is a safe connectivity test and a permanent safety note for the
Phoenix Hibachi AI Studio workflow.

It does not run on the website.
It does not change booking, pricing, Stripe, Supabase, Make, Gmail, Quo,
Cloudflare, Google Workspace, or GitHub Pages behavior.

## Operating Mode

Phoenix AI Studio must use a preview-first workflow:

1. The owner gives a natural-language instruction.
2. The instruction is routed into visual tasks, business-logic tasks, and
   human approval tasks.
3. Changes are made only on a non-main branch.
4. A preview and change summary are produced.
5. The owner approves before anything is published.

## Protected Systems

The following systems require explicit owner approval before any write,
publish, deploy, sync, migration, or destructive action:

- GitHub main branch
- GitHub Pages production deployment
- Supabase database, RLS, functions, migrations, and secrets
- Stripe products, payment links, webhooks, amounts, and keys
- Make scenarios and webhooks
- Gmail or email sending
- Quo workflows and customer messages
- Cloudflare DNS, routing, workers, R2, and Stream
- Google Workspace, Sheets, Drive, Calendar, and customer data
- Ads platforms, SMS platforms, and marketing automations

## Branch Rule

Do not work directly on main.

Every implementation must use a separate branch, such as:

```text
ai-studio-task-short-description
```

or:

```text
agent/task-short-description
```

## Approval Gates

There are three approval gates:

1. Approve local changes.
2. Approve preview or pull request.
3. Approve production publish.

Supabase, Stripe, email, SMS, customer data, and ad platforms require an
additional approval gate before live writes.

## Price And Booking Safety

Any menu, package, add-on, promotion, reward, travel fee, tax, deposit, Stripe,
or balance change must be checked across:

- Homepage
- Packages
- Booking form
- Price calculation
- Admin order details
- Print view
- Customer email or SMS
- Internal notification
- Stripe amount
- Supabase saved order fields

## No Silent Changes

Phoenix AI Studio must not silently:

- Delete files
- Rename core files
- Change live prices
- Change payment rules
- Push to main
- Publish the website
- Modify production database data
- Send customer emails or SMS
- Start ad campaigns
- Import or export customer lists

## Rollback Requirement

Every task must include a rollback method before production release.

For website code, rollback should identify the branch, commit, or pull request
that can restore the previous version.

For database changes, rollback must identify the migration strategy and any
data compatibility requirements.

## Current Test

This file confirms that Codex can safely create a non-runtime file on a
non-main branch without changing the production website.

Created for branch:

```text
ai-studio-safety-test-20260721
```
