import { readdirSync, readFileSync } from "node:fs"

// The mobile app's terms of service and privacy policy. They are separate
// documents from the extension's, and the app does not record which version a
// user agreed to, so there is no manifest for them: the version in effect is
// whichever one the version-less page points at.
//
// This repository publishes them because the app's own repository is private
// and cannot have GitHub Pages, while the App Store and Google Play listings
// need a public URL.
const DOCS_DIR = "docs/app"

const DOC_IDS = ["terms", "privacy"] as const
type DocId = (typeof DOC_IDS)[number]

const docFiles = (id: DocId): string[] =>
  readdirSync(`${DOCS_DIR}/${id}`).filter((name) => name.endsWith(".html"))

const redirectPage = (id: DocId): string =>
  readFileSync(`${DOCS_DIR}/${id}.html`, "utf-8")

// Every link on the page has to name the same file, and it has to sit in this
// document's own directory, or the reader and the crawler are sent to
// different versions — or to the other document altogether.
const versionInEffect = (id: DocId): string => {
  const link = new RegExp(`\\./${id}/(v[\\d.]+\\.html)`, "g")
  const targets = [...redirectPage(id).matchAll(link)]
    .map((m) => m[1])
    .filter((name, i, all) => all.indexOf(name) === i)
  expect(targets).toHaveLength(1)
  return targets[0]
}

describe("the published terms of service and privacy policy of the mobile app", () => {
  it("names every file after its version", () => {
    for (const id of DOC_IDS) {
      for (const name of docFiles(id)) {
        expect(name).toMatch(/^v\d+\.\d+\.html$/)
      }
    }
  })

  it("has a file behind the version-less URL", () => {
    for (const id of DOC_IDS) {
      expect(docFiles(id)).toContain(versionInEffect(id))
    }
  })

  // The terms of service are a promise between the user and the company; the
  // privacy policy is a notice from the company. Where the terms take the
  // privacy policy in, agreeing to the terms agrees to the privacy policy too,
  // and separating the two checkboxes on the welcome screen stops meaning
  // anything. What has become part of the contract also falls outside the
  // procedure for revising standard terms of business (Civil Code article
  // 548-4).
  it("keeps the privacy policy out of the terms of service", () => {
    const body = readFileSync(
      `${DOCS_DIR}/terms/${versionInEffect("terms")}`,
      "utf-8",
    )
    // A link is what makes it a reference the contract takes in. The document
    // may still name the privacy policy — saying that personal data is handled
    // under a separately published policy is not the same as making that
    // policy part of this agreement.
    expect(body).not.toMatch(/href\s*=\s*"[^"]*privacy/i)
  })
})
