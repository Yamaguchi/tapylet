// The published manifest is the one part of this that comes off the network,
// and it decides whether a user is stopped at a consent screen before their own
// wallet. What it may not do therefore matters as much as what it does: it
// cannot take a document below what the build shipped with, it cannot decide
// what a document asks of the user, and it cannot keep the wallet shut by being
// absent, slow or malformed.

import {
  applyLegalManifest,
  BUNDLED_LEGAL_DOCS,
  formatVersion,
  legalDoc,
  mergeLegalManifest,
  parseLegalManifest,
  type LegalManifest,
} from "~/extension/legal"
import { fetchLegalManifest } from "~/extension/legalManifest"

const manifest = (docs: unknown) => ({ docs })

const ahead = (major: number) => `${major}.0`
const termsAhead = ahead(BUNDLED_LEGAL_DOCS.terms.version.major + 1)

describe("parseLegalManifest", () => {
  it("reads a version and a change list per language", () => {
    const parsed = parseLegalManifest(
      manifest({
        terms: { version: "2.0", changes: { ja: ["変えた点"], en: ["what changed"] } },
      }),
    )

    expect(parsed?.docs.terms).toEqual({
      version: { major: 2, minor: 0 },
      changes: { ja: ["変えた点"], en: ["what changed"] },
    })
  })

  it("reads an announcement with the day it takes effect", () => {
    const parsed = parseLegalManifest(
      manifest({
        terms: {
          version: "1.1",
          changes: {},
          upcoming: { version: "2.0", effectiveFrom: "2026-10-01", changes: {} },
        },
      }),
    )

    expect(parsed?.docs.terms?.upcoming).toEqual({
      version: { major: 2, minor: 0 },
      effectiveFrom: "2026-10-01",
      changes: {},
    })
  })

  it.each([null, undefined, 42, "{}", [], { docs: null }, { docs: 1 }])(
    "refuses %p outright",
    (value) => {
      expect(parseLegalManifest(value)).toBeNull()
    },
  )

  it.each([
    ["a version that is not one", { version: "two", changes: {} }],
    ["no version at all", { changes: {} }],
    ["changes that are not lists", { version: "2.0", changes: { ja: "変えた点" } }],
    ["a change that is not a string", { version: "2.0", changes: { ja: [1] } }],
    ["an entry that is not an object", "2.0"],
  ])("drops a document with %s", (_label, entry) => {
    expect(parseLegalManifest(manifest({ terms: entry }))?.docs.terms).toBeUndefined()
  })

  // Taking the version and losing the announcement would put a revision into
  // effect that was never announced.
  it.each([
    ["a date in another format", { version: "2.0", effectiveFrom: "2026/10/01", changes: {} }],
    ["no date", { version: "2.0", changes: {} }],
    ["a version that is not one", { version: "soon", effectiveFrom: "2026-10-01", changes: {} }],
  ])("drops the whole document when the announcement has %s", (_label, upcoming) => {
    const parsed = parseLegalManifest(
      manifest({ terms: { version: "1.1", changes: {}, upcoming } }),
    )

    expect(parsed?.docs.terms).toBeUndefined()
  })

  // The screen it lands on is one the user cannot get past. A list long enough
  // to bury the buttons is a way to make the wallet unusable.
  it("refuses a change list that is too long", () => {
    const lines = Array.from({ length: 21 }, (_, i) => `line ${i}`)

    expect(
      parseLegalManifest(manifest({ terms: { version: "2.0", changes: { ja: lines } } }))
        ?.docs.terms,
    ).toBeUndefined()
  })

  it("refuses a change that is too long", () => {
    const line = "あ".repeat(301)

    expect(
      parseLegalManifest(manifest({ terms: { version: "2.0", changes: { ja: [line] } } }))
        ?.docs.terms,
    ).toBeUndefined()
  })

  it("keeps the documents it can read when another is broken", () => {
    const parsed = parseLegalManifest(
      manifest({ terms: { version: "nope" }, privacy: { version: "2.0", changes: {} } }),
    )

    expect(parsed?.docs.terms).toBeUndefined()
    expect(parsed?.docs.privacy?.version).toEqual({ major: 2, minor: 0 })
  })

  it("ignores documents it has never heard of", () => {
    const parsed = parseLegalManifest(manifest({ cookies: { version: "2.0", changes: {} } }))

    expect(parsed?.docs).toEqual({})
  })
})

describe("mergeLegalManifest", () => {
  it("moves a document forward", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(
        manifest({ terms: { version: termsAhead, changes: { ja: ["変えた点"] } } }),
      ),
    )

    expect(merged.terms.version).toEqual({
      major: BUNDLED_LEGAL_DOCS.terms.version.major + 1,
      minor: 0,
    })
    expect(merged.terms.changes).toEqual({ ja: ["変えた点"] })
  })

  // The build is the floor: a manifest that is out of date, rolled back or
  // tampered with cannot undo a consent this build already knows to ask for.
  it("never takes a document below what the build shipped with", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(manifest({ terms: { version: "0.1", changes: {} } })),
    )

    expect(merged.terms).toEqual(BUNDLED_LEGAL_DOCS.terms)
  })

  it("leaves a document the manifest does not mention", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(manifest({ terms: { version: termsAhead, changes: {} } })),
    )

    expect(merged.privacy).toEqual(BUNDLED_LEGAL_DOCS.privacy)
  })

  // What a document asks of the user follows from what it is in law, not from
  // a file served over the network.
  it("takes what a document asks of the user from the build, not the manifest", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(
        manifest({ privacy: { version: "9.0", changes: {}, kind: "agree" } }),
      ),
    )

    expect(merged.privacy.kind).toBe("acknowledge")
  })

  it("keeps the bundled documents when there is no manifest", () => {
    expect(mergeLegalManifest(BUNDLED_LEGAL_DOCS, null)).toBe(BUNDLED_LEGAL_DOCS)
  })

  // An announcement is published while the version it announces is still to
  // come, so the manifest names the version already in effect. Taking the two
  // together would throw the announcement away for the whole of its life, and
  // the banner would never appear at all.
  it("carries an announcement made against the version in effect", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(
        manifest({
          terms: {
            version: formatVersion(BUNDLED_LEGAL_DOCS.terms.version),
            changes: {},
            upcoming: {
              version: termsAhead,
              effectiveFrom: "2026-10-01",
              changes: { ja: ["変えた点"] },
            },
          },
        }),
      ),
    )

    expect(merged.terms.version).toEqual(BUNDLED_LEGAL_DOCS.terms.version)
    expect(merged.terms.upcoming?.effectiveFrom).toBe("2026-10-01")
  })

  // Being behind on the version in effect says nothing about what is announced.
  it("carries an announcement even when the version is behind the build", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(
        manifest({
          terms: {
            version: "0.1",
            changes: {},
            upcoming: { version: termsAhead, effectiveFrom: "2026-10-01", changes: {} },
          },
        }),
      ),
    )

    expect(merged.terms.version).toEqual(BUNDLED_LEGAL_DOCS.terms.version)
    expect(merged.terms.upcoming?.version).toEqual({
      major: BUNDLED_LEGAL_DOCS.terms.version.major + 1,
      minor: 0,
    })
  })

  // The banner and the re-consent screen would otherwise appear together, each
  // about a different version.
  it("drops an announcement of something already in effect", () => {
    const merged = mergeLegalManifest(
      BUNDLED_LEGAL_DOCS,
      parseLegalManifest(
        manifest({
          terms: {
            version: termsAhead,
            changes: {},
            upcoming: { version: "1.0", effectiveFrom: "2026-10-01", changes: {} },
          },
        }),
      ),
    )

    expect(merged.terms.upcoming).toBeUndefined()
  })
})

describe("applyLegalManifest", () => {
  afterEach(() => applyLegalManifest(null))

  it("puts the published version in effect for the rest of the session", () => {
    applyLegalManifest(
      parseLegalManifest(manifest({ terms: { version: termsAhead, changes: {} } })),
    )

    expect(legalDoc("terms").version.major).toBe(
      BUNDLED_LEGAL_DOCS.terms.version.major + 1,
    )
  })

  it("returns to the bundled documents when there is nothing to apply", () => {
    applyLegalManifest(null)

    expect(legalDoc("terms")).toEqual(BUNDLED_LEGAL_DOCS.terms)
  })
})

// A legal document is a reason to ask the user something, never a reason to
// lock them out of their own keys. Every failure here has to end as null.
describe("fetchLegalManifest", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  const respond = (body: string, init: { ok?: boolean } = {}) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: init.ok ?? true,
      text: () => Promise.resolve(body),
    }) as unknown as typeof fetch
  }

  it("reads the published manifest", async () => {
    respond(JSON.stringify(manifest({ terms: { version: "2.0", changes: {} } })))

    const fetched = (await fetchLegalManifest()) as LegalManifest

    expect(fetched.docs.terms?.version).toEqual({ major: 2, minor: 0 })
  })

  it("asks the host the documents are served from", async () => {
    respond("{}")

    await fetchLegalManifest()

    expect(global.fetch).toHaveBeenCalledWith(
      "https://chaintope.github.io/tapylet/legal.json",
      expect.objectContaining({ credentials: "omit", redirect: "error" }),
    )
  })

  it("gives up on a response that is not ok", async () => {
    respond(JSON.stringify(manifest({ terms: { version: "2.0", changes: {} } })), {
      ok: false,
    })

    expect(await fetchLegalManifest()).toBeNull()
  })

  it("gives up on a body that is not JSON", async () => {
    respond("<!DOCTYPE html>")

    expect(await fetchLegalManifest()).toBeNull()
  })

  it("gives up on a body that is far too large", async () => {
    respond(" ".repeat(64 * 1024 + 1))

    expect(await fetchLegalManifest()).toBeNull()
  })

  it("gives up when the request fails", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("offline")) as unknown as typeof fetch

    expect(await fetchLegalManifest()).toBeNull()
  })
})
