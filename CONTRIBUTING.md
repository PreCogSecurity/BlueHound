# Contributing to BlueHound

Thanks for helping make BlueHound better. This guide is short on purpose: the
bar for a change is that it is *verifiable*.

## Ground rules

1. **Every behaviour change ships with a test.** A bug fix without a test is a
   bug fix that comes back.
2. **Keep commits small and single-purpose.** Do not mix a refactor, a
   reformat and a feature in one commit - it makes the change unreviewable and
   impossible to revert. See `CHANGELOG.md` for what shipped when.
3. **Never commit a secret.** No database passwords, no collector tokens, no
   real customer data in a dashboard export.

## Getting set up

```bash
nvm use            # picks up .nvmrc
npm install        # use `npm ci` if a lockfile is present
```

Node `>= 22.13` is required - the test suite uses the built-in Node test runner
and Node's own TypeScript type stripping, so there is no test framework to
install or keep up to date.

## The checks

```bash
npm test           # unit tests (node --test)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # prettier --write
npm run dev        # development server on http://localhost:3000
```

All four run in CI on every push and pull request, on Linux and Windows.
`typecheck` is currently report-only while the `strict` backlog is worked down;
please do not add new type errors.

## Known technical debt

Worked through deliberately, not avoided:

- `src/collectors/newingestion.js` is ~3,000 lines covering every BloodHound
  entity type. It should be split by entity (`computers`, `groups`, `users`,
  `azure`, ...), one module per entity, each with its own tests. Do that in
  separate commits, each one green.
- `src/page/PageReducer.tsx` still carries the ~1,200-line bundled default
  dashboard inline. Moving it to a JSON asset would make the reducer testable in
  isolation.
- Neo4j 3.x compatibility branches in the ingestion code are only exercised by
  customers still on very old servers; consider dropping them.

## Writing tests

Tests live next to the code they cover, in a `tests/` folder named after the
module, and use `node:test` with `node:assert/strict`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { myThing } from '../myThing.ts';

test('myThing does the thing', () => {
    assert.equal(myThing(1), 2);
});
```

Two rules of thumb:

- Test the real module, not a copy of it. Import from the production path.
- Target logic, not rendering. The harness strips types; it does not compile
  JSX, so component tests are out of scope until a real test compiler is added.

## Security-relevant changes

Read [SECURITY.md](SECURITY.md) first. If your change touches process
execution, archive extraction, URL handling, IPC, or the Electron
`webPreferences`, it needs a negative test that proves the rejected input is
rejected - not just a test that the happy path still works.
