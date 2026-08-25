// The record of what the user agreed to. The extension has no server, so this
// is the whole of it: what is not written here cannot be shown later, and what
// is written here wrongly says the user agreed to something they never saw.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import {
  adoptLegacyConsent,
  AGREED_CONSENTS_KEY,
  ConsentStore,
} from "~/extension/storage/consentStore"
import { LegalNoticeStore } from "~/extension/storage/legalNoticeStore"

import { formatVersion, legalDoc } from "~/extension/legal"

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

const currentTerms = formatVersion(legalDoc("terms").version)
const currentPrivacy = formatVersion(legalDoc("privacy").version)

describe("ConsentStore", () => {
  let inner: FakeStore
  let store: ConsentStore

  beforeEach(() => {
    inner = new FakeStore()
    store = new ConsentStore(inner)
  })

  it("has nothing on record on a fresh install", async () => {
    expect(await store.getAgreedVersions()).toEqual({})
  })

  it("records the documents it is given at the version in effect", async () => {
    await store.agree(["terms", "privacy"])

    expect(inner.values.get(AGREED_CONSENTS_KEY)).toEqual({
      terms: currentTerms,
      privacy: currentPrivacy,
    })
  })

  // The re-consent screen asks about the documents that were revised. Recording
  // the rest would put a version on record that the user was never shown.
  it("leaves the documents it is not given alone", async () => {
    await inner.set(AGREED_CONSENTS_KEY, { terms: "1.0", privacy: "1.0" })

    await store.agree(["terms"])

    expect(inner.values.get(AGREED_CONSENTS_KEY)).toEqual({
      terms: currentTerms,
      privacy: "1.0",
    })
  })

  it("records nothing extra when given an empty list", async () => {
    await inner.set(AGREED_CONSENTS_KEY, { terms: "1.0" })

    await store.agree([])

    expect(inner.values.get(AGREED_CONSENTS_KEY)).toEqual({ terms: "1.0" })
  })

  // `getAgreedVersions` ignores a version ahead of this build, but the record is
  // the only place that consent exists: writing back the sanitised view would
  // delete it for a user who agreed on a later build and then went back.
  it("carries over a version ahead of this build untouched", async () => {
    const ahead = `${legalDoc("privacy").version.major + 1}.0`
    await inner.set(AGREED_CONSENTS_KEY, { privacy: ahead })

    await store.agree(["terms"])

    expect(inner.values.get(AGREED_CONSENTS_KEY)).toEqual({
      terms: currentTerms,
      privacy: ahead,
    })
  })

  it("reads back a stored version", async () => {
    await inner.set(AGREED_CONSENTS_KEY, { terms: "1.0" })

    expect(await store.getAgreedVersions()).toEqual({
      terms: { major: 1, minor: 0 },
    })
  })

  // Versions only ever move forward, so one ahead of this build can only be a
  // downgrade or a hand-edited value. Trusting it would skip a consent that was
  // never given.
  it("drops a version ahead of the one this build knows", async () => {
    await inner.set(AGREED_CONSENTS_KEY, {
      terms: `${legalDoc("terms").version.major + 1}.0`,
    })

    expect(await store.getAgreedVersions()).toEqual({})
  })

  it.each([{ terms: "one" }, { terms: 1 }, { terms: null }, "not an object"])(
    "treats %p as no record at all",
    async (stored) => {
      await inner.set(AGREED_CONSENTS_KEY, stored)

      expect(await store.getAgreedVersions()).toEqual({})
    },
  )
})

// What an install that predates the record already agreed to.
describe("adoptLegacyConsent", () => {
  let storage: FakeStore
  const hasWallet = () => Promise.resolve(true)
  const noWallet = () => Promise.resolve(false)

  beforeEach(() => {
    storage = new FakeStore()
  })

  // The welcome screen has always required both checkboxes, so an install with
  // a wallet agreed to the versions in force at the time. Without this it is
  // met with a screen announcing a revision that has not happened.
  it("records the versions an existing wallet agreed to", async () => {
    await adoptLegacyConsent(storage, hasWallet)

    expect(storage.values.get(AGREED_CONSENTS_KEY)).toEqual({
      terms: "1.0",
      privacy: "1.0",
    })
  })

  it("records nothing when there is no wallet", async () => {
    await adoptLegacyConsent(storage, noWallet)

    expect(storage.values.has(AGREED_CONSENTS_KEY)).toBe(false)
  })

  it("leaves a record that is already there", async () => {
    await storage.set(AGREED_CONSENTS_KEY, { terms: "2.0", privacy: "1.0" })

    await adoptLegacyConsent(storage, hasWallet)

    expect(storage.values.get(AGREED_CONSENTS_KEY)).toEqual({
      terms: "2.0",
      privacy: "1.0",
    })
  })

  it("is idempotent: a second run changes nothing", async () => {
    await adoptLegacyConsent(storage, hasWallet)
    const afterFirst = new Map(storage.values)
    await adoptLegacyConsent(storage, hasWallet)

    expect(storage.values).toEqual(afterFirst)
  })
})

describe("LegalNoticeStore", () => {
  let inner: FakeStore
  let store: LegalNoticeStore

  beforeEach(() => {
    inner = new FakeStore()
    store = new LegalNoticeStore(inner)
  })

  it("remembers the version whose banner was dismissed", async () => {
    await store.dismiss("terms", "2.0")

    expect(await store.getDismissed()).toEqual({ terms: "2.0" })
  })

  // Both banners are on screen at once when both documents are announced.
  it("keeps both when two banners are dismissed at the same time", async () => {
    await Promise.all([
      store.dismiss("terms", "2.0"),
      store.dismiss("privacy", "2.0"),
    ])

    expect(await store.getDismissed()).toEqual({
      terms: "2.0",
      privacy: "2.0",
    })
  })

  it("ignores a stored value that is not a version", async () => {
    await inner.set("legal_notice_dismissed", { terms: "soon" })

    expect(await store.getDismissed()).toEqual({})
  })
})
