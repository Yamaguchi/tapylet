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

## Terms of Service and Privacy Policy versions

Both documents are published from `docs/` on GitHub Pages, one file per version.
Publishing a version that changes what a document says asks every user to
respond to it the next time the side panel opens; publishing one that does not
simply replaces the text.

| Location | Holds |
| --- | --- |
| `docs/terms/v<version>.html` | The terms of service |
| `docs/privacy/v<version>.html` | The privacy policy |
| `docs/terms.html`, `docs/privacy.html` | A page that sends the version-less URL to the version in effect |
| `docs/legal.json` | Which version is in effect, what changed, and what is announced |
| `src/extension/legal.ts` | The versions this build shipped with, and what each document asks of the user |
| `src/extension/i18n/locales/*.json` | The names of the documents (`legal.docs.*.label`) |

The version-less URLs are the ones handed out to the outside world, so they have
to keep working across a bump. GitHub Pages has no redirect rules, hence the
standing page at each of them.

**A version is two numbers (2.1), and which one is raised decides what the user
sees.**

| Raised | The revision | What the user sees |
| --- | --- | --- |
| Major (2.1 → 3.0) | Rights or obligations change; the purpose of use or the sharing of personal data changes; the service rests on different terms | A banner announces it beforehand, and once it takes effect everyone is asked to agree (acknowledge) again |
| Minor (2.0 → 2.1) | Typos, wording, contact details, section numbering — the meaning is untouched | Nothing. The text is simply replaced |

**Which one it is, is a question for legal.** When in doubt, treat it as major.
Asking for consent that was not needed costs some inconvenience; failing to ask
for consent that was needed cannot be made good afterwards.

Only the major version decides whether a user is asked again (`outdatedDocs()`).
A new user is always shown, and recorded against, the text in effect — minor
included.

Superseded versions are linked from nowhere but stay readable to anyone who
knows the URL (`.../terms/v1.0.html`), so a user can be shown the text they
agreed to at the time. Where one of them points at the other document, it names
the version that stood alongside it (`../privacy/v1.0.html`) rather than the
version-less URL, which would follow whatever is in effect today and leave the
record showing a pairing that never existed.

**A version that has been published is never edited.** It is the record of what
somebody agreed to. Correcting a typo means a new minor version; changing what
the document says means a new major one. A file under `docs/` that is not the
version in effect is history, whatever it says.

**"Agree" and "acknowledge" are not the same thing** (`kind` in
`BUNDLED_LEGAL_DOCS`).

| Document | Asks for | Why |
| --- | --- | --- |
| Terms of service | Agreement (`agree`) | A promise between the user and the company, which takes effect by both sides agreeing |
| Privacy policy | Acknowledgement (`acknowledge`) | A notice from the company saying how personal data is handled. It does not take effect by agreement; the Act on the Protection of Personal Information asks for notification or publication |

The wording on screen follows this, and each document gets its own checkbox. A
combined checkbox would take agreement to something that is only a notice, and
neither consent could then be pointed to on its own.

**The terms of service do not link to the privacy policy.** Saying in the terms
that personal data is handled "as set out in the separate privacy policy" makes
the privacy policy part of the contract, so agreeing to the terms agrees to the
privacy policy as well — separate checkboxes on screen change nothing if the
text has already tied them together. What has become part of the contract also
falls outside the procedure for revising standard terms of business (Civil Code
article 548-4). The terms say only that personal data is handled under the law
and that the handling is published separately — naming the privacy policy is
fine, linking to it as a term of the agreement is not.
`test/legalDocs.test.ts` reads the published text and holds the version in
effect (and any announced version) to this. Superseded versions are left as they
are, under the rule above, and so is version 1.0 of the terms: it was published
with the link in it and cannot be edited now, so version 2.0 is what removes
it.

**Where the user is asked.** The welcome screen carries the checkboxes, and
neither creating nor restoring a wallet is reachable without them. A user who
already has a wallet meets `ConsentUpdateScreen` before the unlock screen, which
lists what changed alongside a link to the text. There is no way past it: the
wallet cannot be unlocked until the user has responded.

Checkboxes start unticked and are ticked by the user. Nothing forces the text to
be scrolled to the end first — ticking each document separately says more, as a
record, than proof that a page was scrolled.

**Where it is recorded.** On the device, in the extension's own storage
(`consentStore`). There is no server and nothing about the user leaves the
device, so this is the whole record: clearing the extension's data clears it,
and the user is asked again. Only the documents the screen put to the user are
written — a screen asking about the terms says nothing about the privacy policy,
and recording both would put a version on record that nobody was shown.

An install that predates this record is credited with the versions in force when
the welcome screen first asked (`adoptLegacyConsent`). Those users did tick both
boxes; there was simply nowhere to keep it. Without that they would be met, on
update, with a screen announcing a revision that has not happened.

**Announce first, then switch.** The terms of service undertake to give notice
of the content of a change and of when it takes effect, by the time it takes
effect (section 7). The banner (`LegalUpdateNotice`) is that notice, so it
carries what changes, when, and a link to the new text. The user can dismiss it;
the dismissed version is remembered, so the same banner does not come back,
while the next announcement does.

The banner stays off the two screens that carry consent checkboxes themselves
(the welcome screen and `ConsentUpdateScreen`). There the version being ticked
now and the version announced for later would sit side by side with nothing to
say which is which, and a user who has yet to agree to anything is owed no
notice of a change to it.

A new version takes effect **when the manifest says so**, not when the date on
the device passes. Leaving the switch to the device clock would flip a user
early or late depending on whose clock is off; the date says when the document
changes, not when one browser notices.

**Revising a document does not need a release.** `docs/legal.json` names the
version of each document that is in effect, and the extension reads it at
startup. Publishing to GitHub Pages is the whole of it — a Web Store release
would otherwise put a review and Chrome's own update schedule between the
decision and the user.

```json
{
  "docs": {
    "terms": {
      "version": "2.0",
      "changes": { "ja": ["…"], "en": ["…"] },
      "upcoming": {
        "version": "3.0",
        "effectiveFrom": "2026-10-01",
        "changes": { "ja": ["…"], "en": ["…"] }
      }
    }
  }
}
```

The change lists travel with the version rather than sitting in the bundled
translations, because the text is written when the revision is. They go straight
to the user, so write them in the user's words. A language the manifest does not
carry falls back to English, and then to no summary at all — the link to the
text itself is always there.

*Raising a major version*

1. Put the new text at `docs/<doc>/v<new version>.html`. Leave the old file.
2. Announce it: add `upcoming` (`version`, `effectiveFrom`, `changes`) to that
   document in `docs/legal.json`. Leave `version` alone. Deploy. The banner
   appears; the old version is still in effect and nobody is asked to respond.
3. On the day it takes effect, move `upcoming` into `version` and `changes`,
   drop `upcoming`, and point `docs/<doc>.html` at the new file so the
   version-less URL follows.
4. Run `pnpm test` and deploy. Users are asked to respond from their next
   launch.

*Raising a minor version*

1. Put the new text at `docs/<doc>/v<new version>.html`. Leave the old file.
2. Raise the version in `docs/legal.json`, and point `docs/<doc>.html` at the
   new file.
3. Run `pnpm test` and deploy. Nothing appears on screen and no existing user is
   asked to respond.

`pnpm test` checks the published files against the manifest: that the version in
effect and any announced version exist, that file names match their versions,
that the version-less page points at the version in effect, that a document
links to the paired version of the other one, and that the terms do not link to
the privacy policy.

**What the build ships with is the floor.** `BUNDLED_LEGAL_DOCS` in
`src/extension/legal.ts` holds the versions that were in effect when the
extension was built, and the manifest can only move a document forward from
there. A manifest that is stale, rolled back or tampered with cannot undo a
consent the build already knows to ask for, and a fresh install that has never
reached the network still holds to something. Bring these values up to the
manifest whenever a release happens — `pnpm test` fails if the manifest has
fallen behind them.

**Nothing about the gate depends on the network.** The manifest is fetched
beside the screen rather than in front of it: the version in effect for this
launch is the one last read (`legalManifestStore`), and today's copy is stored
for the next one. A refusal, a timeout, a body that is not the manifest — each
leaves what was already there. What a document says can never be a reason a
wallet will not open, so a revision reaches a user one launch after their
browser first sees it.

The manifest also cannot say just anything. Its versions and dates have to be
readable as such, a change list is capped in length and in the length of each
line, and `kind` — what a document asks of the user — is never taken from it at
all: that follows from what the document is in law.

## The mobile app's terms and privacy policy

The mobile app (`chaintope/tapylet-for-mobile`) has its own terms of service and
privacy policy, separate from the ones above. Its repository is private and so
cannot have GitHub Pages, while the App Store and Google Play listings need a
public URL, so the documents are published from here, under `docs/app/`
alongside `min-version.json`.

| Location | Holds |
| --- | --- |
| `docs/app/terms/v<version>.html` | The terms of service |
| `docs/app/privacy/v<version>.html` | The privacy policy |
| `docs/app/terms.html`, `docs/app/privacy.html` | A page that sends the version-less URL to the version in effect |

The app links to the version-less URLs and does not record which version a user
agreed to, so there is no manifest for these documents: the version in effect is
whichever file the version-less page points at. A revision reaches every user as
soon as it is deployed, and nobody is asked to respond to it. Publishing one is:

1. Put the new text at `docs/app/<doc>/v<new version>.html`. Leave the old file.
2. Point `docs/app/<doc>.html` at the new file.
3. Run `pnpm test` and deploy.

The rules the extension's documents follow hold here too: a published version is
never edited, and superseded versions stay readable at their own URL.
`test/mobileLegalDocs.test.ts` checks that file names match their versions, that
the version-less page points at a file that exists, and that the terms do not
link to the privacy policy.

**Swapping the file is not itself notice.** Section 8 of the mobile terms
undertakes to announce a revision, and its effective date, before it takes
effect — and to ask for consent where the law requires it. The app has nothing
to announce it with: no manifest, no banner, no record of what was agreed to. A
revision that changes rights or obligations therefore has to be carried by
something else — an announcement on the company site ahead of the date, or a
release of the app that asks again on the screen. Deploying here is the last
step of that, not the whole of it. Wording and typos need none of this.

## License

MIT
