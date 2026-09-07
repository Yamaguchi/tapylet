/**
 * The versions of the terms of service and the privacy policy that are in
 * effect, and the rules for deciding what a new version asks of the user.
 *
 * A version is two numbers (2.1), and which one is raised decides what the user
 * sees.
 *
 * - major … the user's rights or obligations change, or the handling of
 *   personal data changes. Announced before it takes effect, and once it does,
 *   everyone is asked to agree (or acknowledge) again.
 * - minor … typos, wording, section numbering — anything that leaves the
 *   meaning untouched. Nothing is announced and nothing is asked; the text is
 *   simply replaced.
 *
 * Each version keeps its own file (docs/<doc>/v<version>.html, served from
 * GitHub Pages). Which version is in effect is published alongside them, as
 * docs/legal.json, and read at startup — so a revision reaches users without a
 * Web Store release, which would otherwise put a review and Chrome's own update
 * schedule between the decision and the user.
 *
 * The versions below are the ones this build shipped with. They are the floor:
 * the published manifest can move a document forward, never back, and if it
 * cannot be read at all these are what the extension holds to. Nothing about
 * the gate depends on the network succeeding.
 *
 * What the user agreed to is stored on this device
 * (~/extension/storage/consentStore); the extension has no server, so there is
 * nowhere else it could be kept.
 *
 * The procedure for raising a version is in the README ("Terms of Service and
 * Privacy Policy versions").
 */

export const LEGAL_BASE_URL = "https://chaintope.github.io/tapylet"

export const LEGAL_DOC_IDS = ["terms", "privacy"] as const

export type LegalDocId = (typeof LEGAL_DOC_IDS)[number]

/**
 * What the user is asked to do, decided by what the document is in law.
 *
 * - `agree` … the terms of service are a promise between the user and the
 *   company, and take effect by both sides agreeing.
 * - `acknowledge` … the privacy policy is a notice from the company saying how
 *   personal data is handled. It is not something that takes effect by
 *   agreement, so what is asked for is not consent but confirmation that it has
 *   been read. Asking for consent would leave no defined outcome if that
 *   consent were later withdrawn.
 */
export type ConsentKind = "agree" | "acknowledge"

export interface LegalVersion {
  major: number
  minor: number
}

/**
 * An announced version. Its text can already be read, but it is not yet in
 * effect. Only a major version is ever announced.
 *
 * The terms of service undertake to give notice of the content of a change and
 * of when it takes effect, by the time it takes effect (section 7). The notice
 * banner is that notice.
 *
 * On the day it takes effect, the manifest names it as the version in effect
 * and drops it from here. The switch is never made by comparing the date on the
 * device: a clock that is off would flip a user early or late on its own, and
 * the date is a statement about when the document changes, not about when a
 * particular device notices.
 */
export interface UpcomingLegalDoc {
  version: LegalVersion
  /** The day it takes effect (YYYY-MM-DD). Shown in the notice banner. */
  effectiveFrom: string
  changes: LocalisedChanges
}

/**
 * What changed, by language tag, as it will be read out on the re-consent
 * screen and in the banner. It travels with the version rather than sitting in
 * the bundled translations: the text is written when the revision is, and a
 * revision does not wait for a release.
 */
export type LocalisedChanges = Record<string, string[]>

export interface LegalDoc {
  kind: ConsentKind
  version: LegalVersion
  changes: LocalisedChanges
  upcoming?: UpcomingLegalDoc
}

/**
 * What this build shipped with. Never revised in place — a new version is
 * published to the manifest; this only moves when a release happens to carry
 * one.
 */
export const BUNDLED_LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: {
    kind: "agree",
    version: { major: 2, minor: 1 },
    changes: {},
  },
  privacy: {
    kind: "acknowledge",
    version: { major: 2, minor: 1 },
    changes: {},
  },
}

// The documents as they stand now: the bundled floor, with anything the
// published manifest has moved forward folded in (see applyLegalManifest).
let current: Record<LegalDocId, LegalDoc> = BUNDLED_LEGAL_DOCS

/** The document as it stands now. */
export const legalDoc = (id: LegalDocId): LegalDoc => current[id]

/**
 * The lines of a change list in the user's language, falling back to English
 * and then to nothing. A missing translation leaves the screen without a
 * summary; it never leaves it without the link to the text itself.
 */
export const changesFor = (
  changes: LocalisedChanges,
  language: string,
): string[] => changes[language] ?? changes[language.split("-")[0]] ?? changes.en ?? []

/** i18n key for the display name of a document. */
export const legalLabelKey = (id: LegalDocId): string => `legal.docs.${id}.label`

/** i18n keys for the words around a document name in a consent checkbox. */
export const consentLabelKeys = (
  id: LegalDocId,
): { prefix: string; suffix: string } => ({
  prefix: `legal.consent.${legalDoc(id).kind}.prefix`,
  suffix: `legal.consent.${legalDoc(id).kind}.suffix`,
})

/** Version as it is written down ('2.1'). Used in URLs and in storage. */
export const formatVersion = (version: LegalVersion): string =>
  `${version.major}.${version.minor}`

/** Reads '2.1'. Returns null for anything else. */
export const parseVersion = (value: unknown): LegalVersion | null => {
  if (typeof value !== "string") return null
  const matched = /^(\d+)\.(\d+)$/.exec(value)
  if (!matched) return null
  return { major: Number(matched[1]), minor: Number(matched[2]) }
}

/**
 * The published text of a document. Omit the version for the one in effect.
 * Superseded versions are linked from nowhere, but stay readable to anyone who
 * knows the URL, so a user can be shown the text they agreed to at the time.
 */
export const legalDocUrl = (id: LegalDocId, version?: LegalVersion): string =>
  `${LEGAL_BASE_URL}/${id}/v${formatVersion(version ?? legalDoc(id).version)}.html`

export const isLegalDocId = (value: unknown): value is LegalDocId =>
  typeof value === "string" && (LEGAL_DOC_IDS as readonly string[]).includes(value)

/** The documents with an announced version, paired with that version. */
export const upcomingDocs = (): {
  id: LegalDocId
  upcoming: UpcomingLegalDoc
}[] =>
  LEGAL_DOC_IDS.flatMap((id) => {
    const upcoming = legalDoc(id).upcoming
    return upcoming ? [{ id, upcoming }] : []
  })

/**
 * The day a version takes effect, in the user's language.
 *
 * Pinned to UTC because the value is a plain date with no time zone of its own:
 * read in local time it would land on the previous or next day for users far
 * enough east or west.
 */
export const formatEffectiveFrom = (date: string, language: string): string => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  // Handed back as written when it cannot be read as a date. Intl throws on an
  // invalid one, and the banner is drawn above every screen with no error
  // boundary between: a mistyped constant would take the whole side panel down
  // rather than one line of it.
  if (!matched) return date
  const [, year, month, day] = matched
  try {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  } catch {
    // The language is not the constant's doing: it comes from the browser
    // through the language detector, so a tag Intl rejects is out of this
    // codebase's hands and must not be allowed to take the panel down either.
    return date
  }
}

/**
 * The documents that must be agreed to (acknowledged) again. Only the major
 * version decides: a minor revision does not change the meaning, so it does not
 * ask anything of the user. A document with no record counts as outstanding —
 * without a record there is nothing to show that it was ever agreed to.
 */
export const outdatedDocs = (
  agreedMajors: Partial<Record<LegalDocId, number>> | null | undefined,
): LegalDocId[] =>
  LEGAL_DOC_IDS.filter(
    (id) => (agreedMajors?.[id] ?? 0) < legalDoc(id).version.major,
  )

/** Keeps only the major versions, which is all the comparison above needs. */
export const majorsOf = (
  agreed: Partial<Record<LegalDocId, LegalVersion>>,
): Partial<Record<LegalDocId, number>> => {
  const majors: Partial<Record<LegalDocId, number>> = {}
  for (const id of LEGAL_DOC_IDS) {
    const version = agreed[id]
    if (version) majors[id] = version.major
  }
  return majors
}

/**
 * The published statement of which version of each document is in effect.
 *
 * Served from the same place as the documents themselves (docs/legal.json), so
 * a revision is a deploy of static files rather than a Web Store release.
 */
export interface LegalManifest {
  docs: Partial<Record<LegalDocId, ManifestDoc>>
}

interface ManifestDoc {
  version: LegalVersion
  changes: LocalisedChanges
  upcoming?: UpcomingLegalDoc
}

// Bounds on what is accepted. The manifest is fetched over the network and
// rendered on a screen the user cannot get past, so its size is not left to
// whatever is served: a list long enough to bury the buttons, or a line long
// enough to push them off the panel, would be a way to make the wallet
// unusable.
const MAX_CHANGES = 20
const MAX_CHANGE_LENGTH = 300
const MAX_LANGUAGES = 10

const parseChanges = (value: unknown): LocalisedChanges | null => {
  if (typeof value !== "object" || value === null) return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_LANGUAGES) return null

  const changes: LocalisedChanges = {}
  for (const [language, lines] of entries) {
    if (!Array.isArray(lines) || lines.length > MAX_CHANGES) return null
    if (
      !lines.every(
        (line) => typeof line === "string" && line.length <= MAX_CHANGE_LENGTH,
      )
    ) {
      return null
    }
    changes[language] = lines as string[]
  }
  return changes
}

const parseUpcoming = (value: unknown): UpcomingLegalDoc | null => {
  if (typeof value !== "object" || value === null) return null
  const upcoming = value as Record<string, unknown>
  const version = parseVersion(upcoming.version)
  const changes = parseChanges(upcoming.changes ?? {})
  if (!version || !changes) return null
  if (
    typeof upcoming.effectiveFrom !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(upcoming.effectiveFrom)
  ) {
    return null
  }
  return { version, effectiveFrom: upcoming.effectiveFrom, changes }
}

/**
 * Reads a manifest, or returns null for anything that is not one.
 *
 * Nothing partial is accepted: a document whose entry cannot be read is left
 * out, and a manifest that is not an object at all is rejected outright. The
 * caller falls back to what it already had, which is what makes a broken or
 * unreachable manifest a no-op rather than an outage.
 */
export const parseLegalManifest = (value: unknown): LegalManifest | null => {
  if (typeof value !== "object" || value === null) return null
  const docs = (value as Record<string, unknown>).docs
  if (typeof docs !== "object" || docs === null) return null

  const parsed: LegalManifest = { docs: {} }
  for (const id of LEGAL_DOC_IDS) {
    const entry = (docs as Record<string, unknown>)[id]
    if (typeof entry !== "object" || entry === null) continue
    const doc = entry as Record<string, unknown>

    const version = parseVersion(doc.version)
    const changes = parseChanges(doc.changes ?? {})
    if (!version || !changes) continue

    const upcoming =
      doc.upcoming === undefined ? undefined : parseUpcoming(doc.upcoming)
    // An entry that names an announcement it cannot express is dropped whole:
    // taking the version and losing the announcement would put the revision in
    // effect without ever having announced it.
    if (doc.upcoming !== undefined && !upcoming) continue

    parsed.docs[id] = { version, changes, ...(upcoming ? { upcoming } : {}) }
  }
  return parsed
}

/**
 * A manifest written back out the way it is published.
 *
 * Anything kept for the next launch goes through this first. A stored manifest
 * is read with parseLegalManifest, which takes a version as the string it is
 * written as ('2.0') — handing it the parsed form back would drop every entry,
 * and the manifest would quietly stop deciding anything at all.
 */
export const serializeLegalManifest = (manifest: LegalManifest): unknown => {
  const docs: Record<string, unknown> = {}
  for (const id of LEGAL_DOC_IDS) {
    const doc = manifest.docs[id]
    if (!doc) continue
    docs[id] = {
      version: formatVersion(doc.version),
      changes: doc.changes,
      ...(doc.upcoming
        ? {
            upcoming: {
              version: formatVersion(doc.upcoming.version),
              effectiveFrom: doc.upcoming.effectiveFrom,
              changes: doc.upcoming.changes,
            },
          }
        : {}),
    }
  }
  return { docs }
}

/** Compares two versions the way a reader would: major first, then minor. */
const isNewer = (a: LegalVersion, b: LegalVersion): boolean =>
  a.major !== b.major ? a.major > b.major : a.minor > b.minor

/**
 * The documents as the manifest leaves them.
 *
 * A document only ever moves forward. What the build shipped with is the floor,
 * so a manifest that is out of date, rolled back or tampered with cannot undo a
 * consent this build already knows to ask for. `kind` is never taken from the
 * manifest: what a document asks of the user follows from what it is in law,
 * and that is not a matter for a published file to decide.
 */
export const mergeLegalManifest = (
  bundled: Record<LegalDocId, LegalDoc>,
  manifest: LegalManifest | null,
): Record<LegalDocId, LegalDoc> => {
  if (!manifest) return bundled

  const merged = {} as Record<LegalDocId, LegalDoc>
  for (const id of LEGAL_DOC_IDS) {
    const base = bundled[id]
    const published = manifest.docs[id]
    if (!published) {
      merged[id] = base
      continue
    }

    // The version and the announcement are decided separately. An announcement
    // is published while the version it announces is still to come, so at that
    // point the manifest names the version already in effect — taking the two
    // together would throw the announcement away for as long as it is an
    // announcement, which is the whole of its life.
    const moved = isNewer(published.version, base.version)
    const version = moved ? published.version : base.version
    const upcoming = published.upcoming

    merged[id] = {
      kind: base.kind,
      version,
      changes: moved ? published.changes : base.changes,
      // An announcement of something already in effect is not an
      // announcement; it would put the banner and the re-consent screen on
      // screen together, each about a different version.
      ...(upcoming && isNewer(upcoming.version, version) ? { upcoming } : {}),
    }
  }
  return merged
}

/**
 * Puts the published manifest into effect for the rest of this session.
 *
 * Called once at startup, before the first screen is drawn, with what was last
 * read from the network (see ~/extension/legalManifest). A fetch that arrives
 * later is stored for next time rather than applied: a document changing under
 * a user who is midway through the wallet would be a worse surprise than
 * finding out when they next open it.
 */
export const applyLegalManifest = (manifest: LegalManifest | null): void => {
  current = mergeLegalManifest(BUNDLED_LEGAL_DOCS, manifest)
}
