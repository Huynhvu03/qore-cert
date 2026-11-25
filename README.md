# QoreCert — Post-Quantum Signed Certificates on QoreChain

Built for **Build Before Q-Day: The QoreChain Developer Fest** (Category: **Quantum Pass**).

QoreCert lets anyone issue, anchor, and independently verify tamper-proof digital certificates using **NIST FIPS-204 ML-DSA-87** signatures and **SHAKE-256** digests, anchored on **QoreChain Testnet (`qorechain-diana`)** via hybrid-signed (`secp256k1 + ML-DSA-87`) QoreX transactions.

## Features

1. **ML-DSA-87 (FIPS-204) Certificate Signing**: Issues canonical JSON certificates with 2,592-byte public keys and 4,627-byte post-quantum signatures.
2. **QoreX Wallet & Live PQC Status**: Connects directly to QoreX Testnet (`@qorechain/react` `ConnectButton`, `useAccount`, `useBalance`, `usePqcStatus`, `PqcStatusBadge`, `QuantumSafeBadge`).
3. **On-Chain Hybrid Anchoring**: Anchors the certificate's SHAKE-256 digest and `pubkeyHash` onto QoreChain Testnet via `useTx().sendTokens` with a compact `QoreCert:v1:<digest>:<pubkeyHash>` memo.
4. **Fail-Closed Verifier**: Independently verifies digest integrity, `pubkeyHash`, and ML-DSA-87 signature offline; any 1-character tamper is rejected.

## Quickstart

```bash
npm install
npm test
npm run build
npm run dev
```

## Credits & Open-Source Libraries

- [QoreChain SDK (`@qorechain/sdk`, `@qorechain/react`, `@qorechain/pqc`)](https://github.com/qorechain/qorechain-sdk) — network presets, QoreX hooks, ML-DSA-87 & SHAKE-256 primitives, inspired by `create-qorechain-dapp` (`fullstack-web`).
- `@noble/post-quantum` and `@noble/hashes` (bundled via `@qorechain/pqc`).

## Live anchor proof (testnet, 25 Nov 2026)

A real certificate was issued and anchored on `qorechain-diana` from the
agent account `qor18tzlrmfrkle25ethj97fm4an4udznaufmk2uv9`:

- Anchor tx: `BBCE2ADAAE4BF2AC0C6E71883316E62C849BEDB07D6DBB8D7D361D94576D4FA4` (block 10,729,299, code 0)
- Memo: `QoreCert:v1:3c89d86269c343b6fcb6cfc6a0f25e63:fc39b9409e4d1b53`
- Certificate digest: `3c89d86269c343b6fcb6cfc6a0f25e6324c3ed3e345c24a8ab071af339a4727e`
- Explorer: https://explore.qore.network/tx/BBCE2ADAAE4BF2AC0C6E71883316E62C849BEDB07D6DBB8D7D361D94576D4FA4

Reproduce with `scripts/anchor-cli.ts` (mnemonic accounts) or
`scripts/anchor-cli-key.ts` (PRIVATE_KEY + QORE_PQC_RECOVERY_CODE accounts).
