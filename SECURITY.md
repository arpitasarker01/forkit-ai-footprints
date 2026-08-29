# Security

## Supported release

Security fixes target the latest npm release and the current `main` branch.
Older versions may not receive backports. Confirm the installed version with:

```bash
npx --yes forkit-ai-footprints@latest --version
```

## Report a vulnerability privately

Use **Report a vulnerability** in the repository Security tab to open a private
GitHub Security Advisory. If that is unavailable, email `security@forkit.dev`.

Include the affected version, impact, minimal reproduction, and suggested
remediation when possible. Do not include real credentials, prompts, customer
data, or unnecessary device identity. Maintainers will acknowledge a usable
report, investigate it privately, and coordinate a fix before public disclosure.

Do not open public issues containing credentials, tokens, private model paths,
customer identifiers, prompts, responses, terminal output, or other sensitive
local data.

Changes affecting process inspection, filesystem inspection, local endpoints,
report output, hashing, or future integrations require privacy and security
review. A contribution must never add remote endpoint support, authentication,
passport publication, registry writes, Runtime_C2 mutation, or telemetry upload
without explicit founder approval and a product-boundary review.

The only currently approved remote write is the versioned, aggregate-only
Global AI Preview contribution described in `PRIVACY.md`. It requires explicit
consent and one valid observed hour. Security reports should flag any path that
bypasses that boundary.
