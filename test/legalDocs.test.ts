import { readdirSync, readFileSync } from "node:fs"

import {
  BUNDLED_LEGAL_DOCS,
  formatVersion,
  legalDocUrl,
  parseLegalManifest,
  upcomingDocs,
  legalDoc,
  LEGAL_DOC_IDS,
  type LegalDocId,
} from "~/extension/legal"

// Looks at the published text itself. It is HTML, so neither the compiler nor
// any other test sees it; checking it as a string is the only way its rules can
// be held to.
const DOCS_DIR = "docs"

const docFiles = (id: LegalDocId): string[] =>
  readdirSync(`${DOCS_DIR}/${id}`).filter((name) => name.endsWith(".html"))

describe("the published terms of service and privacy policy", () => {
  it("has a file for the version in effect", () => {
    for (const id of LEGAL_DOC_IDS) {
      expect(docFiles(id)).toContain(
        `v${formatVersion(legalDoc(id).version)}.html`,
      )
    }
  })

  it("names every file after its version", () => {
    for (const id of LEGAL_DOC_IDS) {
      for (const name of docFiles(id)) {
        expect(name).toMatch(/^v\d+\.\d+\.html$/)
      }
    }
  })

  it("has a file behind every URL the extension links to", () => {
    for (const id of LEGAL_DOC_IDS) {
      expect(docFiles(id)).toContain(legalDocUrl(id).split("/").pop())
    }
  })

  // The terms of service are a promise between the user and the company; the
  // privacy policy is a notice from the company. Where the terms take the
  // privacy policy in, agreeing to the terms agrees to the privacy policy too,
  // and separating the two checkboxes stops meaning anything. What has become
  // part of the contract also falls outside the procedure for revising standard
  // terms of business (Civil Code article 548-4).
  //
  // Only the version in effect and any announced version are held to this. A
  // superseded version is the record of what somebody agreed to and is never
  // edited, whatever it says.
  it("keeps the privacy policy out of the terms of service", () => {
    const upcoming = legalDoc("terms").upcoming
    const live = [
      `v${formatVersion(legalDoc("terms").version)}.html`,
      ...(upcoming ? [`v${formatVersion(upcoming.version)}.html`] : []),
    ]
    for (const name of live) {
      const body = readFileSync(`${DOCS_DIR}/terms/${name}`, "utf-8")
      // A link is what makes it a reference the contract takes in. The document
      // may still name the privacy policy — saying that personal data is
      // handled under a separately published policy is not the same as making
      // that policy part of this agreement.
      expect(body).not.toMatch(/href\s*=\s*"[^"]*privacy/i)
    }
  })

  // The banner reads this constant, and a version it cannot parse would
  // otherwise be caught by nobody until it is on screen.
  it("dates an announced version as YYYY-MM-DD", () => {
    for (const { upcoming } of upcomingDocs()) {
      expect(upcoming.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  // The version-less URL is the one handed out to the outside world and the one
  // older builds still link to. GitHub Pages has no redirect rules, so the page
  // at that URL is what carries the user to the version in effect.
  it("sends the version-less URL to the version in effect", () => {
    for (const id of LEGAL_DOC_IDS) {
      const stub = readFileSync(`${DOCS_DIR}/${id}.html`, "utf-8")
      expect(stub).toContain(
        `./${id}/v${formatVersion(legalDoc(id).version)}.html`,
      )
    }
  })

  // A document that points at the other one names the version that stood
  // alongside it. The version-less URL would follow whatever is in effect
  // today, and the record would show a pairing that never existed — and a
  // relative path from the version-less layout no longer resolves at all now
  // that the files sit one directory down.
  it("links to the paired version of the other document, and it exists", () => {
    for (const id of LEGAL_DOC_IDS) {
      for (const name of docFiles(id)) {
        const body = readFileSync(`${DOCS_DIR}/${id}/${name}`, "utf-8")
        for (const other of LEGAL_DOC_IDS) {
          const links = [...body.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
          for (const link of links.filter((l) => l.includes(other))) {
            expect(link).toMatch(
              new RegExp(`^\\.\\./${other}/v\\d+\\.\\d+\\.html$`),
            )
            expect(docFiles(other)).toContain(link.split("/").pop())
          }
        }
      }
    }
  })

  // The banner links to the announced text. Announcing before publishing it
  // leaves that link on a page that does not exist.
  it("has a file for an announced version", () => {
    for (const { id, upcoming } of upcomingDocs()) {
      expect(docFiles(id)).toContain(`v${formatVersion(upcoming.version)}.html`)
    }
  })
})

// The published manifest is what decides the version in effect once this is
// deployed, so it is held to the same rules as the documents beside it.
describe("the published manifest", () => {
  const manifest = parseLegalManifest(
    JSON.parse(readFileSync(`${DOCS_DIR}/legal.json`, "utf-8")),
  )

  it("can be read as one", () => {
    expect(manifest).not.toBeNull()
    for (const id of LEGAL_DOC_IDS) {
      expect(manifest?.docs[id]).toBeDefined()
    }
  })

  it("has a file for every version it names", () => {
    for (const id of LEGAL_DOC_IDS) {
      const doc = manifest?.docs[id]
      if (!doc) continue
      expect(docFiles(id)).toContain(`v${formatVersion(doc.version)}.html`)
      if (doc.upcoming) {
        expect(docFiles(id)).toContain(`v${formatVersion(doc.upcoming.version)}.html`)
      }
    }
  })

  // A manifest behind the build says nothing: the build is the floor, so a
  // version below it is ignored, and the file would be there to mislead.
  it("names at least the version this build shipped with", () => {
    for (const id of LEGAL_DOC_IDS) {
      const published = manifest?.docs[id]?.version
      const bundled = BUNDLED_LEGAL_DOCS[id].version
      expect(published).toBeDefined()
      if (!published) continue
      expect(
        published.major > bundled.major ||
          (published.major === bundled.major && published.minor >= bundled.minor),
      ).toBe(true)
    }
  })
})
