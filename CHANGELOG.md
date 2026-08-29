# Changelog

All notable public changes to Forkit AI Footprints are documented here.

## 0.2.4 — 2026-08-28

- Fixed long-running observation timing so cumulative valid and AI-active
  totals remain stable while bounded timeline history is retained locally.
- Preserved one observation across reconnects, sleep, lock, and inactivity
  gaps without counting excluded time.
- Added bounded per-app CPU and memory history summaries while keeping raw
  process data local and out of global contributions.
- Published the npm-first Apple Silicon macOS app bootstrap.
- Enabled the explicitly consented, community-reported Global AI Preview after
  one valid observed hour, using a signed allowlisted aggregate and one latest
  row per stable local contribution key.
- Added public contribution, security, ownership, dependency, and issue-report
  workflows for open-source collaboration.

## 0.2.3 — 2026-08-27

- Improved stopped-observation persistence and reconnect behavior.
- Kept the previous useful local result visible without silently restarting
  monitoring.

## 0.2.2 — 2026-08-27

- Strengthened local monitoring, privacy boundaries, and release validation.
