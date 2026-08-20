// Extension-specific storage singletons: inject the Plasmo adapters into the
// platform-agnostic store classes from @tapylet/core/storage. App code imports the
// singletons (and the re-exported core types/constants) from this one place.

import { WalletStorage } from "@tapylet/core/storage/walletStorage"
import { IssuedTokenStore } from "@tapylet/core/storage/issuedTokenStore"
import { PendingTxStore } from "@tapylet/core/storage/pendingTxStore"
import { SettingsStore } from "@tapylet/core/storage/settingsStore"
import { PlasmoKeyValueStore, PlasmoSecureStore } from "./adapters/plasmo"
import { adoptLegacyConsent, ConsentStore } from "./consentStore"
import { LegalManifestStore } from "./legalManifestStore"
import { LegalNoticeStore } from "./legalNoticeStore"

export const walletStorage = new WalletStorage(
  new PlasmoSecureStore(),
  new PlasmoKeyValueStore(),
)
export const issuedTokenStore = new IssuedTokenStore(new PlasmoKeyValueStore())
export const pendingTxStore = new PendingTxStore(new PlasmoKeyValueStore())
export const settingsStore = new SettingsStore(new PlasmoKeyValueStore())

// What the user agreed to, and which announcements they have dismissed. Both
// describe the user rather than the chain, so they sit in the plain store
// alongside the wallet.
const legalStore = new PlasmoKeyValueStore()
export const consentStore = new ConsentStore(legalStore)
export const legalNoticeStore = new LegalNoticeStore(legalStore)
export const legalManifestStore = new LegalManifestStore(legalStore)

/**
 * Brings already-stored data up to date with the current layout. Awaited during
 * startup, before the first screen is shown (see src/sidepanel.tsx) — the
 * consent record is read to decide that screen.
 */
export const runStorageMigrations = (): Promise<void> =>
  adoptLegacyConsent(legalStore, () => walletStorage.walletExists())

// Re-export core types and constants so callers can import everything from here.
export type { IssuedToken } from "@tapylet/core/storage/issuedTokenStore"
export type { PendingTransaction } from "@tapylet/core/storage/pendingTxStore"
export {
  DEFAULT_AUTO_LOCK_MINUTES,
  AUTO_LOCK_OPTIONS,
} from "@tapylet/core/storage/settingsStore"
