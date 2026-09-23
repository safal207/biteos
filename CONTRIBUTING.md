# Contributing to BiteOS

Thanks for helping improve the restaurant-ordering demo. Please keep changes focused on a guest, restaurant, courier, or kiosk scenario, and describe the visible before/after behavior in your pull request.

## Start locally

Use Node.js 24+, pnpm 11.19.0, Go 1.21+, and Rust 1.93+ with a working linker. From the repository root:

```sh
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm --dir apps/kiosk install --frozen-lockfile
node scripts/dev.mjs
```

Open `http://127.0.0.1:5173`. For the browser-only GitHub Pages variant, use `pnpm --dir apps/kiosk build:pages`. See the [README](README.md) for the two runtime modes and [README.ru.md](README.ru.md) for detailed setup.

## Before a pull request

- For a bug, open an issue with reproduction steps, the expected result, and the actual result. For a feature, explain the user flow and which mode it affects.
- Run `node scripts/test.mjs` for code changes. Run `node scripts/build.mjs` when the local Go/Rust build is affected. Include screenshots or a short recording for visual changes.
- Keep prices and discounts explicit, and require a guest action before adding a paid item. Avoid claims of real payments, dispatch, sales lift, or production readiness: those are outside this demo.
- Do not add third-party photos or brand material without documented rights. Check [NOTICE.md](NOTICE.md) and [docs/assets.md](docs/assets.md).

CI checks the frontend, Go and Rust tests, formatting, and the Go race detector. Please state which checks you ran and any known limitation in the pull request.
