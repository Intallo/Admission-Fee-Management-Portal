# Environment Variables Register

**Fill exact variable names from source inspection; do not invent keys.** Runtime and variable names were not verifiable from the connected reference repository in this session.

| Exact variable name | Required | Used by | Purpose | Secret? | Default/local handling | Verified in code at |
|---|---|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO | TODO | TODO |

Review checklist:
- List every variable in source/config/manifests.
- Separate server secrets from browser-public config.
- Keep `.env.example` placeholder-only.
- Ignore `.env`, credentials, private keys, local dumps and uploads.
- Fail safely when required config missing; redact error/log values.
- Document secure injection for local/test/Client-managed production.
- Never commit actual connection strings, passwords, auth/signing keys or storage credentials.
