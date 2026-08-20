// Namespaces a KeyValueStore's keys, so per-network data (pending
// transactions, issued token records) does not leak across a network switch:
// a transaction broadcast on testnet must not appear as pending on mainnet.
//
// The prefix is resolved per call rather than fixed at construction, so the
// singletons in ../index.ts survive a switch without being rebuilt.

import type { KeyValueStore } from "@tapylet/core/storage/types"

/**
 * The namespace one network's chain data lives under. Exported so the startup
 * migration (../migrations.ts) writes exactly the keys this wrapper reads.
 */
export const networkKeyPrefix = (networkId: number): string =>
  `net_${networkId}_`

export class PrefixedKeyValueStore implements KeyValueStore {
  constructor(
    private inner: KeyValueStore,
    private prefix: () => string,
  ) {}

  private scoped(key: string): string {
    return `${this.prefix()}${key}`
  }

  async get<T>(key: string): Promise<T | null> {
    return this.inner.get<T>(this.scoped(key))
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.inner.set(this.scoped(key), value)
  }

  async remove(key: string): Promise<void> {
    await this.inner.remove(this.scoped(key))
  }

  // The prefix is resolved once, when the subscription is made: a watcher
  // registered on one network keeps reporting that network's key. Nothing
  // watches a network-scoped key today, and a subscription that silently
  // followed the switch would deliver another network's values to a caller
  // that never asked for them.
  watch(key: string, callback: (newValue: unknown) => void): () => void {
    return this.inner.watch(this.scoped(key), callback)
  }
}
