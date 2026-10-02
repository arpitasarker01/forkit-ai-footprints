# Forkit AI public-site analytics collector

First-party event collector for the isolated `forkit-ai.com` website.

It accepts only an explicit allowlist of public-site interaction event names. It does not accept prompts, code, AI activity, account identity, form bodies, cookies, repository contents, or product payloads.

The browser creates a random session id in `sessionStorage`; the collector hashes it before emitting a structured Cloud Logging event. No database is used.

Deployment guardrails:
- Cloud Run, `europe-west1`
- min instances: 0
- max instances: 1
- 256 MiB memory
- no persistent storage
- Firebase Hosting rewrites same-origin `/events` to the service
- Cloud Run request logs should be excluded from the default log sink so only the sanitized structured event remains
