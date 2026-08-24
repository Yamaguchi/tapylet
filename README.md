# Tapylet

A Chrome extension wallet for Tapyrus.

## Features

- Wallet creation (BIP39 mnemonic generation)
- Wallet restoration (from mnemonic phrase)
- Password-protected encryption
- Tapyrus address display

## Tech Stack

- [Plasmo](https://docs.plasmo.com/) - Browser extension framework
- [React](https://react.dev/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [tapyrusjs-lib](https://github.com/chaintope/tapyrusjs-lib) - Tapyrus library
- [@noble/secp256k1](https://github.com/paulmillr/noble-secp256k1) - Elliptic curve cryptography

## Supported Networks

- Tapyrus API / Mainnet (NetworkId: 15215628) — default
- Tapyrus Testnet (NetworkId: 1939510133)

The network is switched at runtime from the settings screen and the choice is
persisted. Pending transactions and issued token records are stored per
network, so switching never mixes one chain's data into the other.

An install that already holds a wallet the first time this build runs starts on
Testnet rather than the default: testnet was the only network the extension
could reach before the switch existed, and that is where its data is. The
choice is recorded on that first run, so a wallet created later — on the
default — is not mistaken for one of those installs.

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
pnpm install
```

### Start Development Server

```bash
pnpm dev
```

### Load in Chrome

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` folder

### Production Build

```bash
pnpm build
```

Build artifacts will be generated in `build/chrome-mv3-prod`.

### Environment Variables

Create a `.env.local` file to point the **testnet** entry at a different
explorer. Mainnet is not overridable: a local explorer stands in for the test
chain, never for mainnet.

```bash
# Explorer API endpoint (default: https://testnet-explorer.tapyrus.dev.chaintope.com/api)
PLASMO_PUBLIC_EXPLORER_API_URL=http://localhost:3001/api

# Explorer URL for transaction/color links (default: https://testnet-explorer.tapyrus.dev.chaintope.com)
PLASMO_PUBLIC_EXPLORER_URL=http://localhost:4200
```

This is useful for local development with [tapyrus-explorer](https://github.com/chaintope/tapyrus-explorer).
Select "Testnet" in the settings screen to use it, and add the local origin to
`manifest.host_permissions` in `package.json` — Chrome blocks requests to hosts
the extension has not declared.

## HD Wallet Derivation Path

Compliant with [TIP-0044](https://github.com/chaintope/tips/blob/main/tip-0044.md):

```
m/44'/1939510133'/0'/0/0
      └── NetworkId (Testnet)
```

The path does not change when the network is switched: the same address is used
on every Tapyrus network, so switching does not re-derive the wallet.

## License

MIT
