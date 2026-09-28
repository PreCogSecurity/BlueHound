# Security Policy

BlueHound is used against production Active Directory and Azure tenants. It
holds a Neo4j connection with read access to the whole attack graph, and it
launches collection tooling on the analyst's workstation. Treat a BlueHound
issue the way you would treat a bug in a privileged remote-administration tool.

## Reporting a vulnerability

Report suspected vulnerabilities privately to **security@zeronetworks.com**.
Please include the BlueHound version, your OS, the steps to reproduce, and the
impact you believe it has. Do not open a public issue for a suspected
vulnerability.

We aim to acknowledge a report within three business days and to share a
remediation plan once the report is confirmed.

## Security model in one paragraph

BlueHound is a local desktop application. It has no server component, no
telemetry, and no account system: the analyst supplies their own Neo4j instance
and their own collection tooling. The trust boundaries are therefore (a) the
rendered content - report descriptions, chart `infoURL`s, and community-shared
dashboards that can be imported, (b) collector input - SharpHound/ShotHound
result archives, which are untrusted files, and (c) the local filesystem, where
the persisted profile holds the Neo4j password.

## What is enforced today

- **The renderer has no Node.js access.** `nodeIntegration` is off,
  `contextIsolation` and `sandbox` are on. Every privileged operation goes
  through the narrow `contextBridge` API in `src/preload.js`. Previously
  `nodeIntegration: true` was set, so any script injection into rendered
  content was remote code execution.
- **External links are allow-listed.** Only `http:` and `https:` URLs reach
  `shell.openExternal`; `file:`, `smb:`, `ms-msdt:`, `data:` and friends are
  rejected and logged. The window also refuses to navigate away from the app.
- **Device permissions are denied.** The permission request and check handlers
  always return `false`.
- **Scheduled tasks are built from allow-listed values.** The frequency, day
  and time are validated and passed to `SCHTASKS` as discrete argv entries
  with no shell involved. The previous implementation interpolated
  renderer-supplied values into a `shell: true` command string.
- **Collectors are launched without a shell.** Tool paths and arguments are
  validated and passed to `child_process.spawn` as discrete argv entries.
- **Result archives cannot escape the extraction directory.** Every entry in a
  SharpHound zip is reduced to a flat, traversal-free name and the resulting
  path is re-checked against the temp directory.
- **Ingestion failures are never silent.** A failed `session.run` is logged
  and surfaced to the analyst instead of being swallowed, so a partial import
  cannot be mistaken for a complete one.
- **Logs are redacted.** Anything that looks like a password, token or
  `neo4j://user:pass@host` URI is masked before it reaches the console buffer
  that the About dialog can export for a support bundle.

## Known, accepted risks

These are deliberate product trade-offs, not oversights. If you are hardening a
fleet, plan for them.

1. **The Neo4j password is persisted in the local profile.** The whole Redux
   store, including `application.connection.password`, is written to
   `localStorage` so the app can reconnect on launch. Anyone with filesystem
   access to the profile - or any code that can run in the renderer - can read
   it in clear text. The recommended fix is to move it to the OS keychain
   (`keytar`) and add a "do not remember credentials" option; that is a
   behaviour change and has not been made here because it would remove the
   auto-reconnect that users depend on.
2. **Collector tools execute with the analyst's privileges.** A tool path
   chosen in the collection modal is launched as the current user. BlueHound
   deliberately does not sandbox collection tooling; run it in a dedicated
   analysis workstation, not a domain admin's daily driver.
3. **The Cypher editor runs arbitrary Cypher.** That is the product. Queries
   execute against whatever database the analyst connects to, and a Cypher
   statement can delete data. Point BlueHound at a database you are willing to
   lose.
4. **The development server has no authentication.** `npm run dev` serves the
   dashboard to anyone who can reach the port. Keep it on `localhost` (the
   default).

## Hardening guidance for a managed deployment

- Run BlueHound on a dedicated analysis host, not a workstation with cached
  domain credentials.
- Restrict the Neo4j account BlueHound uses to the schema privileges it needs;
  ingestion creates indexes and constraints.
- Treat a `tools/` binary and its arguments as untrusted input. Remove secrets
  from collector arguments before sharing a configuration export - BlueHound
  exports tool arguments, and while it strips the database credentials it does
  not strip arbitrary arguments.
- Keep BlueHound updated; the Electron runtime in particular carries
  renderer-level vulnerabilities that are only fixed by upgrading.
