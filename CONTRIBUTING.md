# Contributing to DeQueue

DeQueue started as a CS 398 course project and continues as a personal
project. Contributions, bug reports, and suggestions are welcome.

## Ground rules

- Be respectful — see the [Code of Conduct](CODE_OF_CONDUCT.md).
- Open an issue before starting large changes so we can align on approach.
- Keep pull requests focused; unrelated changes should be separate PRs.

## Getting set up

See [README.md § Running locally](README.md#running-locally) for build and
dev-server instructions. Quick version:

```bash
npm install
npm run dev    # watch mode, load dist/ as an unpacked extension
npm test       # run the test suite
```

## Making a change

1. Fork the repo and create a branch from `dev` (not `main`).
2. Make your change, following the existing code style (ESLint/Prettier are
   configured — run `npm run lint` before committing).
3. Add or update tests for any behavior change. See
   [design document § Testing Plan](docs/design_documentation/DeQueue.md#9-testing-plan)
   for what is and isn't expected to be unit tested.
4. Make sure `npm test` passes locally.
5. Open a pull request against `dev`, describing what changed and why.

## Reporting bugs

Use the [bug report template](../../issues/new?template=bug_report.yml) and
include:

- Browser and version (Chrome, Brave, Firefox)
- Steps to reproduce
- Expected vs. actual behavior

## Suggesting features

Check the [Planned features](README.md#planned-features) list first — it
may already be tracked. Otherwise, use the
[feature request template](../../issues/new?template=feature_request.yml).

## Security issues

Please do not open a public issue for security vulnerabilities — see
[SECURITY.md](SECURITY.md) instead.
