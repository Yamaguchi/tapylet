// The version of each legal document this installation agreed to (or
// acknowledged). Read at startup to decide whether the user has to be asked
// again before the wallet can be unlocked.
//
// This is the only record there is: the extension has no server, and nothing
// about the user leaves the device. Clearing the extension's data therefore
// clears the record too, and the user is asked again — which is the safe way
// round.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import {
  formatVersion,
  legalDoc,
  LEGAL_DOC_IDS,
  parseVersion,
  type LegalDocId,
  type LegalVersion,
} from "~/extension/legal"

/**
 * Exported so the startup migration below (`adoptLegacyConsent`) and its tests
 * can reach the same key this class reads, without either side spelling it out
 * twice.
 */
export const AGREED_CONSENTS_KEY = "legal_consents"

export class ConsentStore {
  constructor(private storage: KeyValueStore) {}

  /**
   * The versions on record, empty when there is nothing stored. A stored
   * version ahead of the one this build knows about is dropped rather than
   * trusted: versions only ever move forward, so it can only be a downgrade or
   * a hand-edited value, and treating it as agreed would skip a consent that
   * was never given.
   */
  async getAgreedVersions(): Promise<Partial<Record<LegalDocId, LegalVersion>>> {
    const stored = await this.storage.get<Record<string, unknown>>(
      AGREED_CONSENTS_KEY,
    )
    if (!stored || typeof stored !== "object") return {}

    const agreed: Partial<Record<LegalDocId, LegalVersion>> = {}
    for (const id of LEGAL_DOC_IDS) {
      const version = parseVersion(stored[id])
      if (version && version.major <= legalDoc(id).version.major) {
        agreed[id] = version
      }
    }
    return agreed
  }

  /**
   * Records the given documents at the version in effect, and leaves the rest
   * of the record alone.
   *
   * Only what the user was shown is recorded. A screen that asks about the
   * terms of service says nothing about the privacy policy, and writing the
   * current version for both would put a version on record that nobody was
   * ever shown — in the one place that is meant to show what was agreed to.
   *
   * What is already stored is carried over as it stands, not as this build
   * reads it. `getAgreedVersions` ignores a version ahead of this build, and
   * writing back what it returns would delete that consent from the only place
   * it exists: a user who agreed on a later build and then went back to an
   * earlier one would lose the record of it for good.
   */
  async agree(ids: LegalDocId[]): Promise<void> {
    const stored = await this.storage.get<Record<string, unknown>>(
      AGREED_CONSENTS_KEY,
    )
    const record: Record<string, unknown> =
      stored && typeof stored === "object" ? { ...stored } : {}
    for (const id of ids) {
      record[id] = formatVersion(legalDoc(id).version)
    }
    await this.storage.set(AGREED_CONSENTS_KEY, record)
  }
}

// The versions in force when the welcome screen first asked for consent.
// Written out rather than read from LEGAL_DOCS: this says what those users were
// shown, which does not move when a document is revised.
const LEGACY_CONSENT_VERSIONS = { terms: "1.0", privacy: "1.0" }

/**
 * Puts on record the consent an install gave before there was anywhere to keep
 * it.
 *
 * The welcome screen has always required both checkboxes, so an install that
 * has a wallet agreed to the versions above — nothing was stored, that is all.
 * Without this they count as never having agreed, and are met with a screen
 * announcing a revision that has not happened, listing no changes because there
 * are none.
 *
 * Only ever writes a record that is not there yet.
 */
export const adoptLegacyConsent = async (
  storage: KeyValueStore,
  walletExists: () => Promise<boolean>,
): Promise<void> => {
  if ((await storage.get(AGREED_CONSENTS_KEY)) !== null) return
  if (!(await walletExists())) return
  await storage.set(AGREED_CONSENTS_KEY, LEGACY_CONSENT_VERSIONS)
}
