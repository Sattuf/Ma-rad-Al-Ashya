# infra/secrets

Files here are mounted read-only into Alertmanager at `/etc/alertmanager/secrets` and are
ignored by git (only this README is tracked).

| File | Used by |
|---|---|
| `telegram_bot_token` | `telegram_configs.bot_token_file` in `infra/monitoring/alertmanager/alertmanager.yml` |
| `smtp_password` | `email_configs.auth_password_file` |

One value per file, no quotes. After adding one, uncomment the matching notifier and run
`docker compose -f infra/docker-compose.yml --profile monitoring up -d alertmanager`.
