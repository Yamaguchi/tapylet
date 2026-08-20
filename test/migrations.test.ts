// The one place that bridges pre-network-switch data into the new layout. It
// hand-writes the old key names, so a mistake here does not throw: the data is
// simply never found again, and an issued token record cannot be reconstructed
// (its payment base, outpoint and metadata are needed to file the registry
// registration). Both the key names and the move itself are asserted.

import {
  IssuedTokenStore,
  type IssuedToken,
} from "@tapylet/core/storage/issuedTokenStore"
import {
  PendingTxStore,
  type PendingTransaction,
} from "@tapylet/core/storage/pendingTxStore"
import type { KeyValueStore } from "@tapylet/core/storage/types"

import { networkKeyPrefix } from "~/extension/storage/adapters/prefixed"
import {
  adoptLegacyNetworkChoice,
  migrateLegacyNetworkKeys,
} from "~/extension/storage/migrations"
import { SELECTED_NETWORK_KEY } from "~/extension/storage/networkStore"

import { NETWORKS } from "~/extension/constants/network"

/** In-memory KeyValueStore that exposes the raw keys it was handed. */
class FakeStore implements KeyValueStore {
  values = new Map<string, unknown>()

  async get<T>(key: string): Promise<T | null> {
    return (this.values.get(key) as T) ?? null
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value)
  }
  async remove(key: string): Promise<void> {
    this.values.delete(key)
  }
  watch(_key: string, _callback: (newValue: unknown) => void): () => void {
    return () => {}
  }
}

const testnetPrefix = networkKeyPrefix(NETWORKS.testnet.id)
const mainnetPrefix = networkKeyPrefix(NETWORKS.mainnet.id)

const PENDING_TX: PendingTransaction = {
  txid: "a".repeat(64),
  amount: 1000,
  toAddress: "1Someaddress",
  timestamp: 1700000000000,
}

const ISSUED_TOKEN: IssuedToken = {
  colorId: "c1".padEnd(66, "0"),
  paymentBase: "02".padEnd(66, "0"),
  txid: "b".repeat(64),
  outPoint: `${"b".repeat(64)}00000000`,
  metadata: {
    version: "1",
    name: "Token",
    symbol: "TKN",
    tokenType: "reissuable",
  },
  timestamp: 1700000000000,
}

describe("migrateLegacyNetworkKeys", () => {
  let storage: FakeStore

  beforeEach(() => {
    storage = new FakeStore()
  })

  // The migration spells the old key names out by hand. If @tapylet/core ever
  // renames one, this fails — and the fix is a new migration step for the new
  // name, not an edit to LEGACY_KEYS (which must keep naming what is on disk).
  it("moves the keys @tapylet/core actually writes", async () => {
    const legacy = new FakeStore()
    await new PendingTxStore(legacy).add(PENDING_TX)
    await new IssuedTokenStore(legacy).add(ISSUED_TOKEN)
    const writtenKeys = [...legacy.values.keys()]
    expect(writtenKeys).toHaveLength(2)

    // Hand those exact keys to the migration as an install predating the
    // switch would have left them: unprefixed, at the store root.
    for (const [key, value] of legacy.values) {
      await storage.set(key, value)
    }
    await migrateLegacyNetworkKeys(storage)

    expect([...storage.values.keys()].sort()).toEqual(
      writtenKeys.map((k) => `${testnetPrefix}${k}`).sort(),
    )
  })

  it("files unprefixed data under testnet", async () => {
    await storage.set("pending_transactions", [PENDING_TX])
    await storage.set("issued_tokens", [ISSUED_TOKEN])

    await migrateLegacyNetworkKeys(storage)

    expect(await storage.get(`${testnetPrefix}pending_transactions`)).toEqual([
      PENDING_TX,
    ])
    expect(await storage.get(`${testnetPrefix}issued_tokens`)).toEqual([
      ISSUED_TOKEN,
    ])
  })

  it("removes the old keys, so the data is not read twice", async () => {
    await storage.set("pending_transactions", [PENDING_TX])
    await storage.set("issued_tokens", [ISSUED_TOKEN])

    await migrateLegacyNetworkKeys(storage)

    expect(storage.values.has("pending_transactions")).toBe(false)
    expect(storage.values.has("issued_tokens")).toBe(false)
  })

  it("leaves nothing in the mainnet namespace", async () => {
    await storage.set("pending_transactions", [PENDING_TX])
    await storage.set("issued_tokens", [ISSUED_TOKEN])

    await migrateLegacyNetworkKeys(storage)

    const mainnetKeys = [...storage.values.keys()].filter((k) =>
      k.startsWith(mainnetPrefix),
    )
    expect(mainnetKeys).toEqual([])
  })

  it("does not overwrite data already stored under testnet", async () => {
    const newer = [{ ...ISSUED_TOKEN, colorId: "c2".padEnd(66, "0") }]
    await storage.set("issued_tokens", [ISSUED_TOKEN])
    await storage.set(`${testnetPrefix}issued_tokens`, newer)

    await migrateLegacyNetworkKeys(storage)

    expect(await storage.get(`${testnetPrefix}issued_tokens`)).toEqual(newer)
    expect(storage.values.has("issued_tokens")).toBe(false)
  })

  it("is idempotent: a second run changes nothing", async () => {
    await storage.set("pending_transactions", [PENDING_TX])
    await storage.set("issued_tokens", [ISSUED_TOKEN])

    await migrateLegacyNetworkKeys(storage)
    const afterFirst = new Map(storage.values)
    await migrateLegacyNetworkKeys(storage)

    expect(storage.values).toEqual(afterFirst)
  })

  it("does nothing on a fresh install", async () => {
    await migrateLegacyNetworkKeys(storage)

    expect(storage.values.size).toBe(0)
  })

  it("moves an empty list too, rather than treating it as absent", async () => {
    // An install that sent and confirmed everything has [] on disk. Leaving it
    // behind would keep an unprefixed key around for a later run to find.
    await storage.set("pending_transactions", [])

    await migrateLegacyNetworkKeys(storage)

    expect(await storage.get(`${testnetPrefix}pending_transactions`)).toEqual([])
    expect(storage.values.has("pending_transactions")).toBe(false)
  })

  it("leaves keys it does not own alone", async () => {
    await storage.set("wallet_exists", true)
    await storage.set("auto_lock_minutes", 5)

    await migrateLegacyNetworkKeys(storage)

    expect(await storage.get("wallet_exists")).toBe(true)
    expect(await storage.get("auto_lock_minutes")).toBe(5)
  })
})

// Which network an existing install lands on. Getting this wrong shows a user
// with a wallet an empty balance on a network they never chose.
describe("adoptLegacyNetworkChoice", () => {
  let storage: FakeStore
  const hasWallet = () => Promise.resolve(true)
  const noWallet = () => Promise.resolve(false)

  beforeEach(() => {
    storage = new FakeStore()
  })

  it("keeps an existing wallet on testnet", async () => {
    await adoptLegacyNetworkChoice(storage, hasWallet)

    expect(await storage.get(SELECTED_NETWORK_KEY)).toBe("testnet")
  })

  // A fresh install belongs on the default, which is mainnet.
  it("chooses nothing when there is no wallet", async () => {
    await adoptLegacyNetworkChoice(storage, noWallet)

    expect(storage.values.has(SELECTED_NETWORK_KEY)).toBe(false)
  })

  it("leaves a choice the user has already made", async () => {
    await storage.set(SELECTED_NETWORK_KEY, "mainnet")

    await adoptLegacyNetworkChoice(storage, hasWallet)

    expect(await storage.get(SELECTED_NETWORK_KEY)).toBe("mainnet")
  })

  it("is idempotent: a second run changes nothing", async () => {
    await adoptLegacyNetworkChoice(storage, hasWallet)
    const afterFirst = new Map(storage.values)
    await adoptLegacyNetworkChoice(storage, hasWallet)

    expect(storage.values).toEqual(afterFirst)
  })
})
