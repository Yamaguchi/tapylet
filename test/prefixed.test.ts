// The wrapper that keeps one network's chain data out of the other's. A
// mistake here does not throw — it silently shows testnet transactions on
// mainnet, or hides data that is still there — so the namespacing is asserted
// directly rather than through a screen.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import { PrefixedKeyValueStore } from "~/extension/storage/adapters/prefixed"

/** Records the keys it is handed, so the prefix itself can be asserted. */
class FakeStore implements KeyValueStore {
  values = new Map<string, unknown>()
  watched: string[] = []

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T) ?? null
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value)
  }
  async remove(key: string): Promise<void> {
    this.values.delete(key)
  }
  watch(key: string, _callback: (newValue: unknown) => void): () => void {
    this.watched.push(key)
    return () => {}
  }
}

describe("PrefixedKeyValueStore", () => {
  let inner: FakeStore
  let prefix: string
  let store: PrefixedKeyValueStore

  beforeEach(() => {
    inner = new FakeStore()
    prefix = "net_1_"
    store = new PrefixedKeyValueStore(inner, () => prefix)
  })

  it("writes through under the prefixed key", async () => {
    await store.set("pending_txs", [1])
    expect(inner.values.has("net_1_pending_txs")).toBe(true)
    expect(inner.values.has("pending_txs")).toBe(false)
  })

  it("reads back what it wrote", async () => {
    await store.set("pending_txs", [1])
    expect(await store.get("pending_txs")).toEqual([1])
  })

  it("returns null for a key written under another prefix", async () => {
    await store.set("pending_txs", [1])
    prefix = "net_2_"
    expect(await store.get("pending_txs")).toBeNull()
  })

  it("keeps both networks' values when the same key is used", async () => {
    await store.set("pending_txs", ["mainnet"])
    prefix = "net_2_"
    await store.set("pending_txs", ["testnet"])
    prefix = "net_1_"
    expect(await store.get("pending_txs")).toEqual(["mainnet"])
    prefix = "net_2_"
    expect(await store.get("pending_txs")).toEqual(["testnet"])
  })

  it("removes only the current prefix's key", async () => {
    await store.set("pending_txs", ["mainnet"])
    prefix = "net_2_"
    await store.set("pending_txs", ["testnet"])
    await store.remove("pending_txs")
    prefix = "net_1_"
    expect(await store.get("pending_txs")).toEqual(["mainnet"])
  })

  it("resolves the prefix per call, so the singleton survives a switch", async () => {
    await store.set("a", 1)
    prefix = "net_2_"
    await store.set("a", 2)
    expect([...inner.values.keys()].sort()).toEqual(["net_1_a", "net_2_a"])
  })

  it("pins a watcher to the prefix in effect when it subscribed", () => {
    store.watch("a", () => {})
    prefix = "net_2_"
    store.watch("a", () => {})
    expect(inner.watched).toEqual(["net_1_a", "net_2_a"])
  })
})
