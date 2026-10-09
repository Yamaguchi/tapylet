import type { WalletData, NetworkWalletKeys } from "@tapylet/core/types/wallet"

import { NETWORK_KEYS, NETWORKS } from "~/extension/constants/network"

import { deriveNetworkWallet } from "./deriveNetworkWallet"

/**
 * Builds the WalletData stored when a wallet is created or restored.
 *
 * A restored mnemonic may belong to a wallet made before mainnet and testnet
 * had separate keys, and nothing in the mnemonic tells the two apart. Its old
 * mainnet address may still hold funds, so a restore always records one: the
 * pre-split derivation is the same as today's testnet derivation (pinned by
 * @tapylet/core's createLegacyMainnetWallet tests), so the testnet address is
 * that old address. For a wallet made after the split it is an address with no
 * mainnet history, which only costs an empty screen.
 *
 * Deriving from a mnemonic is a pure, offline computation, so unlike the
 * unlock-time backfill a failure here fails the whole build instead of leaving
 * a network out.
 */
export const buildWalletData = async (
  mnemonic: string,
  opts: { restored: boolean },
): Promise<WalletData> => {
  const networks: Record<number, NetworkWalletKeys> = {}
  for (const key of NETWORK_KEYS) {
    networks[NETWORKS[key].id] = await deriveNetworkWallet(mnemonic, NETWORKS[key].id)
  }

  return {
    mnemonic, // plaintext here; encrypted at rest by SecureStorage
    networks,
    createdAt: Date.now(),
    ...(opts.restored && {
      legacyMainnetAddress: networks[NETWORKS.testnet.id].address,
    }),
  }
}
