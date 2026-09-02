## Summary

Explain the user or maintainer outcome and the smallest change that delivers it.

## Related issue

Link the bug report or approved feature proposal.

## Privacy and product boundary

- [ ] No prompts, responses, credentials, account identity, raw process
      commands, process IDs, full paths, or model contents are exposed.
- [ ] No new collection, persistence, remote endpoint, authentication, registry
      write, or telemetry path is introduced without an approved boundary review.
- [ ] Global Preview consent, eligibility, signing, and payload allowlist remain
      unchanged, or the required review is linked.
- [ ] Package versions, release tags, and publishing workflows are unchanged
      unless this is a maintainer-approved release pull request.

## Validation

- [ ] `npm test`
- [ ] `npm run smoke:package`
- [ ] Positive, negative, deduplication, and privacy tests added where relevant.
- [ ] Real-device validation completed where detection or monitoring changed.
- [ ] English/German copy and accessibility checked where the interface changed.

## Evidence

Summarize test output and any redacted screenshots. Do not include private device
data, credentials, prompts, account information, or full paths.
