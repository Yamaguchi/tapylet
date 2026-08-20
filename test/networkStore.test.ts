// The persisted network choice. The fallback matters most: this value is read
// during startup, and throwing here would leave the side panel unable to start.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import { NetworkStore } from "~/extension/storage/networkStore"

import { DEFAULT_NETWORK } from "~/extension/constants/network"

class FakeStore implements KeyValueStore {
  values = new Map<string, unknown>()
  watchers = new Map<string, (newValue: unknown) => void>()

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T) ?? null
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value)
    this.watchers.get(key)?.(value)
  }
  async remove(key: string): Promise<void> {
    this.values.delete(key)
  }
  watch(key: string, callback: (newValue: unknown) => void): () => void {
    this.watchers.set(key, callback)
    return () => this.watchers.delete(key)
  }
}

describe("NetworkStore", () => {
  let inner: FakeStore
  let store: NetworkStore

  beforeEach(() => {
    inner = new FakeStore()
    store = new NetworkStore(inner)
  })

  it("defaults to mainnet when nothing is stored", async () => {
    expect(await store.getNetwork()).toBe(DEFAULT_NETWORK)
    expect(DEFAULT_NETWORK).toBe("mainnet")
  })

  it("round-trips a stored choice", async () => {
    await store.setNetwork("testnet")
    expect(await store.getNetwork()).toBe("testnet")
  })

  it("falls back to the default for a network this build does not know", async () => {
    // A downgrade, or a hand-edited value.
    inner.values.set("selected_network", "regtest")
    expect(await store.getNetwork()).toBe(DEFAULT_NETWORK)
  })

  it("falls back to the default for a value that is not a string", async () => {
    inner.values.set("selected_network", 1939510133)
    expect(await store.getNetwork()).toBe(DEFAULT_NETWORK)
  })

  // `key in NETWORKS` would let these through, and they resolve to an object
  // with no network id, which core rejects at startup.
  it.each(["constructor", "toString", "valueOf", "__proto__"])(
    "falls back to the default for %s",
    async (value) => {
      inner.values.set("selected_network", value)
      expect(await store.getNetwork()).toBe(DEFAULT_NETWORK)
    },
  )

  describe("watchNetwork", () => {
    it("reports a switch made elsewhere", async () => {
      const seen: string[] = []
      store.watchNetwork((key) => seen.push(key))

      await store.setNetwork("testnet")

      expect(seen).toEqual(["testnet"])
    })

    it("ignores a value that is not a network", async () => {
      const seen: string[] = []
      store.watchNetwork((key) => seen.push(key))

      await inner.set("selected_network", "regtest")

      expect(seen).toEqual([])
    })

    it("stops reporting once unsubscribed", async () => {
      const seen: string[] = []
      const unwatch = store.watchNetwork((key) => seen.push(key))

      unwatch()
      await store.setNetwork("testnet")

      expect(seen).toEqual([])
    })
  })
})
