// Persists which Tapyrus network the user selected in the settings screen.
//
// Deliberately not network-scoped (see ./adapters/prefixed): this is the value
// that decides the scope. It is also not part of @tapylet/core's SettingsStore,
// because the set of networks a host offers is the host's own concern.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import {
  DEFAULT_NETWORK,
  isNetworkKey,
  type NetworkKey,
} from "~/extension/constants/network"

/**
 * Exported so the startup migration (./migrations.ts) can seed the same key
 * this class reads, without either side spelling it out twice.
 */
export const SELECTED_NETWORK_KEY = "selected_network"

export class NetworkStore {
  constructor(private storage: KeyValueStore) {}

  /**
   * The stored selection, or the default when nothing is stored or the stored
   * value is not a network this build knows about (a downgrade, or a hand-
   * edited value). Falling back beats throwing: the side panel would otherwise
   * be unable to start.
   */
  async getNetwork(): Promise<NetworkKey> {
    const value = await this.storage.get<string>(SELECTED_NETWORK_KEY)
    return isNetworkKey(value) ? value : DEFAULT_NETWORK
  }

  async setNetwork(key: NetworkKey): Promise<void> {
    await this.storage.set(SELECTED_NETWORK_KEY, key)
  }

  /**
   * Reports a switch made elsewhere. Chrome gives every window its own side
   * panel document, so without this the panels in other windows would keep
   * running on the network they started with while the stored choice says
   * otherwise.
   */
  watchNetwork(callback: (key: NetworkKey) => void): () => void {
    return this.storage.watch(SELECTED_NETWORK_KEY, (value) => {
      if (isNetworkKey(value)) callback(value)
    })
  }
}
