// Reads the published statement of which version of each legal document is in
// effect (docs/legal.json, served from the same place as the documents).
//
// This is what keeps a revision from waiting on a Web Store release: the review
// and Chrome's own update schedule would otherwise sit between the decision to
// revise a document and the user being told about it.
//
// Everything here fails quietly. A refusal, a timeout, a broken file — all of
// them end up as null, and the caller keeps what it already had. The wallet
// must open when the network does not: a legal document is a reason to ask the
// user something, never a reason to lock them out of their own keys.

import { LEGAL_BASE_URL, parseLegalManifest, type LegalManifest } from "./legal"

export const LEGAL_MANIFEST_URL = `${LEGAL_BASE_URL}/legal.json`

// Long enough for a slow connection, short enough that a hanging request is not
// carried into the next launch. Nothing waits on this — it runs beside the
// screen rather than in front of it — so the limit is about not holding a
// request open, not about how long the user waits.
const TIMEOUT_MS = 5000

// The manifest is two documents, a version each and a short list of changes.
// Anything approaching this size is not that file.
const MAX_BYTES = 64 * 1024

/**
 * The published manifest, or null when it cannot be read as one.
 *
 * Null is not an error state: it means "nothing new to say", and the caller
 * carries on with the manifest it already had, or with what the build shipped
 * with.
 */
export const fetchLegalManifest = async (): Promise<LegalManifest | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(LEGAL_MANIFEST_URL, {
      signal: controller.signal,
      cache: "no-cache",
      // Nothing about this request identifies the user, and nothing should.
      credentials: "omit",
      // The host is fixed and declared in host_permissions. A redirect would
      // be a request somewhere else, which is not what this is for.
      redirect: "error",
    })
    if (!response.ok) return null

    const body = await response.text()
    if (body.length > MAX_BYTES) return null

    return parseLegalManifest(JSON.parse(body))
  } catch {
    // Offline, blocked, timed out, not JSON — all the same from here.
    return null
  } finally {
    clearTimeout(timer)
  }
}
