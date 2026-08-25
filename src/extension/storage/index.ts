// Extension-specific storage singletons: inject the Plasmo adapters into the
// platform-agnostic store classes from @tapylet/core/storage. App code imports the
// singletons (and the re-exported core types/constants) from this one place.

import { WalletStorage } from "@tapylet/core/storage/walletStorage"
import { IssuedTokenStore } from "@tapylet/core/storage/issuedTokenStore"
import { PendingTxStore } from "@tapylet/core/storage/pendingTxStore"
import { SettingsStore } from "@tapylet/core/storage/settingsStore"
import { PlasmoKeyValueStore, PlasmoSecureStore } from "./adapters/plasmo"
import { networkKeyPrefix, PrefixedKeyValueStore } from "./adapters/prefixed"
import { adoptLegacyConsent, ConsentStore } from "./consentStore"
import { LegalManifestStore } from "./legalManifestStore"
import { LegalNoticeStore } from "./legalNoticeStore"
import {
  migrateLegacyNetworkKeys,
  settleInitialNetworkChoice,
} from "./migrations"
import { NetworkStore } from "./networkStore"
import { getNetwork } from "~/extension/constants/network"

const plainStore = new PlasmoKeyValueStore()

// Data that describes chain state belongs to one network; data that describes
// the user (the wallet itself, the auto-lock preference, the network choice)
// is shared across both. Addresses are identical on every Tapyrus network —
// the derivation path is fixed (see @tapylet/core/wallet) — so the wallet does
// not need re-deriving on a switch.
const networkScopedStore = new PrefixedKeyValueStore(plainStore, () =>
  networkKeyPrefix(getNetwork().id),
)

export const walletStorage = new WalletStorage(
  new PlasmoSecureStore(),
  plainStore,
)
export const settingsStore = new SettingsStore(plainStore)
export const networkStore = new NetworkStore(plainStore)
export const issuedTokenStore = new IssuedTokenStore(networkScopedStore)
export const pendingTxStore = new PendingTxStore(networkScopedStore)

// What the user agreed to, which announcements they have dismissed, and the
// manifest that says which version is in effect. All three describe the user or
// the documents rather than the chain, so they sit in the plain store: a
// consent given on one network is the same consent on the other.
export const consentStore = new ConsentStore(plainStore)
export const legalNoticeStore = new LegalNoticeStore(plainStore)
export const legalManifestStore = new LegalManifestStore(plainStore)

/**
 * A pending transaction store nailed to one network, for a sequence of calls
 * that must all reach the same namespace however the selection moves while it
 * runs. The singleton above resolves the namespace per call, and a single
 * store operation reads the list and writes it back — a switch landing in that
 * gap would file the previous network's list under the new one.
 */
export const pendingTxStoreFor = (networkId: number): PendingTxStore =>
  new PendingTxStore(
    new PrefixedKeyValueStore(plainStore, () => networkKeyPrefix(networkId)),
  )

/**
 * Brings already-stored data up to date with the current layout. Awaited before
 * the network choice and the consent record are read, and so before any screen
 * is shown (see ~/extension/hooks/useNetwork).
 *
 * The consent step is what puts an existing install's consent on record;
 * reading the record before it ran would ask those users to agree to something
 * that has not changed.
 */
export const runStorageMigrations = async (): Promise<void> => {
  await migrateLegacyNetworkKeys(plainStore)
  await settleInitialNetworkChoice(plainStore, () =>
    walletStorage.walletExists(),
  )
  await adoptLegacyConsent(plainStore, () => walletStorage.walletExists())
}

// Re-export core types and constants so callers can import everything from here.
export type { IssuedToken } from "@tapylet/core/storage/issuedTokenStore"
export type { PendingTransaction } from "@tapylet/core/storage/pendingTxStore"
export {
  DEFAULT_AUTO_LOCK_MINUTES,
  AUTO_LOCK_OPTIONS,
} from "@tapylet/core/storage/settingsStore"
