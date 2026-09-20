# LMS production foundations

The public UI is intentionally unchanged. Production settings live in
`docker/.env`, which is ignored by Git. Start from `production.env.example`.

## Email

Set `MAIL_SERVER`, `MAIL_LOGIN`, `MAIL_PASSWORD`, and `MAIL_DEFAULT_SENDER`, then
recreate the `frappe` service. Registration verification, password reset, and
scheduled notifications should be tested with a real mailbox before launch.

## Backups

`lms-backup.timer` creates a daily database and file backup. Local backups are
kept for seven days by default. Set `BACKUP_REMOTE` to an rclone destination for
off-site copies. A backup is not considered complete until a restore has been
tested on a separate site.

## Monitoring

`lms-health.timer` checks the API and LMS page every five minutes. Set
`HEALTHCHECK_PING_URL` to receive missing-heartbeat alerts from an external
monitoring provider.

## Payments

The existing LMS checkout delegates to Frappe Payments. Kazakhstan providers
need a provider-specific controller and webhook handler. The handler must verify
the provider signature, amount, currency, merchant, and final status before it
updates `LMS Payment`; callbacks must remain idempotent. Use test credentials
first through the `PAYMENT_*` variables. Never expose provider secrets to the
frontend or commit them.
