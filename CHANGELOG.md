# Changelog

All notable changes to BlueHound are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
semantic versioning.

## [Unreleased]

### Security

- **Renderer no longer has Node.js access.** `nodeIntegration` is disabled and
  `sandbox` is enabled in `src/main.ts`; all privileged operations continue to
  go through the `contextBridge` API in `src/preload.js`. Previously any script
  injection into rendered report content was remote code execution.
- **External links are allow-listed to `http:`/`https:`.** `file:`, `smb:`,
  `ms-msdt:`, `data:` and other handler-scheme URLs are rejected and logged
  before `shell.openExternal` is called. URLs containing embedded credentials
  are rejected. The window also refuses in-app navigation and all device
  permission requests.
- **Fixed a command-injection vector in the scheduled-collection task.** The
  frequency, day and time were interpolated into a `SCHTASKS` command string
  launched with `shell: true`, and all three come from renderer state that an
  imported configuration can set. They are now validated against an allow-list
  and passed as discrete argv entries with no shell involved.
- **Fixed zip-slip in result archive extraction.** A crafted SharpHound archive
  could write outside the temp directory. Entry names are now reduced to a flat
  traversal-free name and the resulting path is re-checked against the
  extraction directory.
- **Collector launches are validated.** Tool paths and arguments are checked
  before `spawn` so malformed input from an imported configuration produces a
  clear error instead of an unhandled exception in the main process, and no
  launch path uses a shell.
- **Log output is redacted.** `src/utils/logger.ts` masks password-, token- and
  credential-shaped values, including credentials embedded in `neo4j://` URIs,
  before anything reaches the console buffer the About dialog can export.
- **Dropped the `sanitize-filename` dependency** from the extraction path in
  favour of a small, tested in-tree guard.

### Fixed

- **Ingestion no longer reports false success.** `session.run` failures were
  swallowed with a bare `.catch(console.log)`, so a partial import looked
  identical to a complete one. Failures are now logged, counted, and reported
  to the analyst; post-processing failures are aggregated and surfaced.
- **Ingestion no longer hangs on a failed batch.** The JSON pipeline was only
  resumed on the success path, so one bad batch left the stream paused forever
  and post-processing never ran. Resume now happens in a `finally` block, and
  a stream error is reported instead of leaving the UI waiting.
- **Neo4j 5 is detected correctly.** The check was
  `neoVersion.split(".", 1)[0] >= 5`, which evaluates to `NaN >= 5` and was
  therefore always false; Neo4j 5 fell through to `CALL db.constraints`, a
  procedure that no longer exists there, so "clear existing data" failed on
  current servers. Index creation also used a removed procedure for Neo4j 5.
- **`DROP INDEX` now drops indexes.** The index cleanup listed constraints and
  issued `DROP INDEX <constraint name>` for each.
- **Card settings no longer mutate the store.** Updating or clearing a card
  setting deleted a key on the object owned by the incoming state, so sibling
  card renders saw the change immediately. The delete branch also discarded its
  own result.
- **Reordering cards no longer mutates state.** `swapTwoCardsInPage` spliced
  the incoming `reports` array in place and could build a sparse array for an
  out-of-range index.
- **Stopping a collector twice no longer throws** in the Electron main process.
- Removed a stray `console.log` debug statement from the card reducer.

### Added

- **A real test suite.** The four test files under `src/card/tests/` contained
  nothing but commented-out `TODO` placeholders, and `npm test` invoked
  `ts-mocha`, which was never a declared dependency, so the suite could not run
  at all. It is now 100+ assertions against the real reducers and the new
  security-critical modules, using Node's built-in test runner with no test
  framework to install.
- **Continuous integration.** `.github/workflows/ci.yml` runs install,
  `tsc --noEmit`, `npm test` and `npm run lint` on every push and pull request
  on Linux and Windows, plus a report-only production dependency audit.
- **Lint and format configuration** (`.eslintrc.json`, `.prettierrc`) and
  `lint`/`lint:fix`/`format`/`format:check` scripts.
- **Type declarations for the preload bridge** moved into `src/` and brought in
  line with `src/preload.js`. `global.d.ts` sat outside the tsconfig `include`,
  so it was never compiled and every `window.electron.*` call was untyped.
- `tsc --noEmit` runs in CI as a report-only step for now; the `strict` backlog
  is being worked down and the step becomes required once it is clean.
- **Reproducible install metadata:** `.nvmrc`, an `engines` field, and
  `package-lock.json` is no longer git-ignored so a lockfile can be committed.
  CI prefers `npm ci` and falls back to `npm install` when no lockfile exists.
- **Documentation:** `SECURITY.md` (threat model, what is enforced, accepted
  risks), `CONTRIBUTING.md`, `CHANGELOG.md`, an architecture section in the
  README, and a truthful `.env.example`.
- The nginx stage of `tools/Dockerfile` now runs as the unprivileged `nginx`
  user and prefers `npm ci`.

## [1.0.0]

- Initial release. See `release-notes.md`.
