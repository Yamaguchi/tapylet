// One-time moves of already-stored data, run once at startup before any screen
// reads it (see ~/extension/hooks/useNetwork).
//
// Adding a network switch changed where chain data lives: pending transactions
// and issued token records are now namespaced per network (see
// ./adapters/prefixed). Installs that predate the switch wrote those keys
// unprefixed, so without this they would simply stop being found. Pending
// transactions would merely be re-fetched, but an issued token record holds the
// payment base, outpoint and metadata needed to file its registry
// registration — none of which can be recovered once the key is orphaned.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import { networkKeyPrefix } from "./adapters/prefixed"
import { SELECTED_NETWORK_KEY } from "./networkStore"

import { NETWORKS, type NetworkKey } from "~/extension/constants/network"

// The keys @tapylet/core's PendingTxStore and IssuedTokenStore write. Spelled
// out here rather than imported because these are the *old* names as they exist
// in chrome.storage: if core ever renames a key, this list must keep the old one.
const LEGACY_KEYS = ["pending_transactions", "issued_tokens"]

// Every install that predates the switch was on testnet — it was the only
// network the extension could reach.
const LEGACY_NETWORK: NetworkKey = "testnet"
const LEGACY_NETWORK_PREFIX = networkKeyPrefix(NETWORKS[LEGACY_NETWORK].id)

/**
 * Moves pre-network-switch chain data into the testnet namespace.
 *
 * Idempotent: the source key is removed once copied, so a second run finds
 * nothing. An already-populated destination is left alone and the stale source
 * dropped — that only happens if the user has since used testnet on this
 * build, in which case the newer data is the correct one.
 */
export const migrateLegacyNetworkKeys = async (
  storage: KeyValueStore,
): Promise<void> => {
  for (const key of LEGACY_KEYS) {
    const legacy = await storage.get<unknown>(key)
    if (legacy === null) continue

    const scoped = `${LEGACY_NETWORK_PREFIX}${key}`
    if ((await storage.get(scoped)) === null) {
      await storage.set(scoped, legacy)
    }
    await storage.remove(key)
  }
}

/**
 * Keeps an install that predates the switch on the network it was using.
 *
 * The default for a fresh install is mainnet. Applied to an install that
 * already has a wallet, that default would move the user to a network where
 * the same address holds nothing: the balance reads zero, and the pending
 * transactions and issued tokens moved above are nowhere on screen. Nothing is
 * lost — they are stored under testnet — but there is no sign of where they
 * went.
 *
 * Only ever writes a choice that is not there yet, so a user who has since
 * selected mainnet keeps that selection.
 */
export const adoptLegacyNetworkChoice = async (
  storage: KeyValueStore,
  walletExists: () => Promise<boolean>,
): Promise<void> => {
  if ((await storage.get(SELECTED_NETWORK_KEY)) !== null) return
  if (!(await walletExists())) return
  await storage.set(SELECTED_NETWORK_KEY, LEGACY_NETWORK)
}
