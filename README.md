# BlueHound OS — PreCog Security

**BlueHound** is a CyberSecurity Specialist and 3D digital assistant for PreCog Security,
owned and directed by **timlangeveldt@gmail.com** and **ryanlangeveldt99@gmail.com**.

![](assets/bluehound.png)

## What is it?

BlueHound OS is a single-file, offline-first digital assistant desktop shell:

- **BlueHound Web IDE** — a client-side cybersecurity playground that replaces the
  old (non-functional) v86 Android emulator. It contains six graded detection labs
  (regex triage, Sigma rule authoring, brute-force log parsing, Shannon-entropy
  hunting, flag recovery and CVSS v3 severity bands) plus a **simulated lab terminal**
  for a synthetic RFC 5737 TEST-NET-1 environment (`192.0.2.0/24`). All grading and
  all terminal commands run locally in the browser; no lab target exists off-device
  and no packets are ever sent. Scoring persists in `localStorage`.
- **BlueHound AI** — defensive cybersecurity assistant chat. Local **Ollama** first
  (`http://localhost:11434`), optional OpenRouter. No keys bundled.
- **Cybersecurity Tools** — IP/abuse scan, IP geolocation lookup, live CVE (NVD)
  lookup, breach check (HIBP).
- **Attack Path** — BlueHound-inspired threat mapping: combines entry-point
  reputation, crown-jewel focus and exposure scoring to surface the paths an
  attacker would take (mirrors the ZeroNetworks BlueHound methodology).
- **Store** — PRST token / marketplace hub.
- **Compute** — NodeGo DePIN network.
- **Games** — Pixels on Ronin.
- **Wallet** — WalletConnect + injected EIP-1193 wallet, PRST balance check on
  Robinhood Chain (`0xb2a8E38177c1a023db108e28384aa6055A1c7Ba3`).
- **Persistence** — everything (windows, chat, inputs, IDE state) is saved locally
  to IndexedDB and can be exported/imported as a JSON backup.

## Run locally

```powershell
.\serve.ps1   # serves on http://127.0.0.1:8080
```

No multi-hundred-megabyte emulator assets are required anymore. The Web IDE and its
labs are fully self-contained in `index.html`; only the external CDN links (fonts,
Ethers.js, etc.) need network access.

## Deploy

GitHub Pages serves this branch automatically at:

```
https://precogsecurity.github.io/BlueHound/
```

## Stack

- Vanilla JS single-file app (no build step) — detection labs graded in-browser
- Ollama / OpenRouter for local-first AI
- Ethers.js · WalletConnect · CryptoJS · Axios · Day.js
- IndexedDB + localStorage persistence

Inspired by the [BlueHound blue-team tool](https://github.com/zeronetworks/BlueHound).
