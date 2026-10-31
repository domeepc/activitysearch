# Contributing to ActivitySearch

ActivitySearch is proprietary software (see [LICENSE](LICENSE)). The source code is not open source, and this file does not grant any right to use, copy or modify it.

## Who can contribute

- Contributions are accepted **only from people the copyright holder has invited** and given access to the repository.
- **Unsolicited pull requests, forks and patches are not accepted** and will be closed without review, even if the repository is publicly visible.
- Want to work on ActivitySearch, or found something worth improving? Email **domemdev@gmail.com** first.

## Ownership of contributions

By submitting a contribution (code, documentation, designs or anything else), you confirm that:

- the work is your own, or you have the right to submit it;
- it contains no code copied from sources whose licence would conflict with proprietary use (for example GPL or AGPL code);
- your contribution becomes part of the Software and is owned by the copyright holder, who may use, change and distribute it without restriction.

Invited contributors may be asked to sign a separate contributor agreement before their first contribution is merged.

## Reporting bugs and security issues

- **Security issues**: report privately to domemdev@gmail.com. Never open a public issue for a vulnerability, and don't test against production data or other people's accounts.
- **Bugs**: invited contributors open a GitHub issue with steps to reproduce, what you expected, and what happened. Others can email the same details.

## Workflow for invited contributors

### Branches and commits

- Branch from `main`, named by type: `feature/…`, `fix/…`, `docs/…`.
- Write commit messages that say what changed and why, in the imperative ("Fix refund when a transfer exists").
- Keep pull requests focused on one change; split unrelated work.

### Before opening a pull request

All three must pass:

```bash
pnpm lint
pnpm test
npx tsc --noEmit
```

- **Add a test** for any new logic that handles money, permissions, encryption or data writes. A failing test that your change fixes is the best proof.
- **Backend changes** (`convex/`): follow `convex/_generated/ai/guidelines.md`. Never edit `convex/_generated/` by hand. Schema changes must be deployable against existing data; when removing fields or tables, migrate the data first in a separate change.
- **UI changes**: use the existing components in `components/ui/` (shadcn/ui, Tailwind), support light and dark mode, and keep it accessible (labels, focus, keyboard, contrast). Add screenshots to the pull request.

### Pull requests

- Describe what changed, why, and how you tested it. Call out anything the reviewer must do after merging, such as one-off migrations or new settings.
- Every pull request needs approval from the maintainer before merging.
- Pull requests are squash-merged into `main`.

## Rules that are never negotiable

- **No secrets in the repository**: no API keys, webhook secrets or `.env` files in commits, issues or pull requests.
- **No real personal data** in code, tests, fixtures, screenshots or issues.
- **Money and authorisation are checked on the server.** The browser is never trusted for amounts, prices, permissions or who is allowed to do what.
- **Chat stays end-to-end encrypted.** Changes must never send message text or private keys to the server unencrypted.
- **Don't add dependencies** with licences that conflict with proprietary use, and don't add a dependency for something a few lines of code can do.

## Questions

Email domemdev@gmail.com.
