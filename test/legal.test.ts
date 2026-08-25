import {
  formatEffectiveFrom,
  formatVersion,
  legalDocUrl,
  majorsOf,
  outdatedDocs,
  parseVersion,
  legalDoc,
} from "~/extension/legal"

describe("version numbers", () => {
  it("reads and writes the same form", () => {
    expect(parseVersion("2.1")).toEqual({ major: 2, minor: 1 })
    expect(formatVersion({ major: 2, minor: 1 })).toBe("2.1")
  })

  it("rejects anything that is not two numbers", () => {
    expect(parseVersion("2")).toBeNull()
    expect(parseVersion("v2.1")).toBeNull()
    expect(parseVersion("2.1.3")).toBeNull()
    expect(parseVersion(undefined)).toBeNull()
    expect(parseVersion(2.1)).toBeNull()
  })
})

describe("which documents have to be responded to again", () => {
  const currentMajors = () => ({
    terms: legalDoc("terms").version.major,
    privacy: legalDoc("privacy").version.major,
  })

  it("asks for every document when there is no record", () => {
    expect(outdatedDocs({})).toEqual(["terms", "privacy"])
    expect(outdatedDocs(null)).toEqual(["terms", "privacy"])
  })

  it("asks for nothing once the current major is on record", () => {
    expect(outdatedDocs(currentMajors())).toEqual([])
  })

  it("asks only for the document whose major is behind", () => {
    expect(outdatedDocs({ ...currentMajors(), terms: 0 })).toEqual(["terms"])
  })

  // A minor revision does not change the meaning, so it asks nothing of a user
  // who has already responded to the same major.
  it("ignores the minor version", () => {
    const agreed = majorsOf({
      terms: { major: legalDoc("terms").version.major, minor: 0 },
      privacy: { major: legalDoc("privacy").version.major, minor: 0 },
    })
    expect(outdatedDocs(agreed)).toEqual([])
  })

  it("keeps only the majors of the versions on record", () => {
    expect(majorsOf({ terms: { major: 2, minor: 1 } })).toEqual({ terms: 2 })
  })
})

describe("published text", () => {
  it("links to the version in effect by default", () => {
    expect(legalDocUrl("terms")).toBe(
      `https://chaintope.github.io/tapylet/terms/v${formatVersion(
        legalDoc("terms").version,
      )}.html`,
    )
  })

  it("links to a superseded version when asked for one", () => {
    expect(legalDocUrl("privacy", { major: 1, minor: 0 })).toBe(
      "https://chaintope.github.io/tapylet/privacy/v1.0.html",
    )
  })
})

// The date has no time zone of its own: read in local time it would land on a
// different day for users far enough east or west.
describe("the day a version takes effect", () => {
  it("names the same day in every language", () => {
    expect(formatEffectiveFrom("2026-09-01", "ja")).toBe("2026年9月1日")
    expect(formatEffectiveFrom("2026-09-01", "en")).toBe("September 1, 2026")
  })

  // Intl throws on a date it cannot read, and the banner is drawn above every
  // screen: that would take the side panel down over a mistyped constant.
  it.each(["2026/09/01", "1 September 2026", "", "2026-9-1"])(
    "hands back %p as written rather than throwing",
    (value) => {
      expect(formatEffectiveFrom(value, "ja")).toBe(value)
    },
  )

  // The language comes from the browser through the language detector, so a tag
  // Intl rejects is out of this codebase's hands and must not take the panel
  // down either.
  it.each(["en_US", "", "-"])(
    "hands the date back as written when the language is %p",
    (language) => {
      expect(formatEffectiveFrom("2026-09-01", language)).toBe("2026-09-01")
    },
  )
})
