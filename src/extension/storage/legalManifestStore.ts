// The last manifest that could be read from the network (see
// ~/extension/legalManifest).
//
// Kept because the decision it feeds — whether a document has to be agreed to
// again — is made at startup, before any request could have come back, and
// because the wallet has to behave the same offline. What was true the last
// time the extension could see the manifest is the best answer available.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import { parseLegalManifest, type LegalManifest } from "~/extension/legal"

const CACHED_MANIFEST_KEY = "legal_manifest"

export class LegalManifestStore {
  constructor(private storage: KeyValueStore) {}

  /**
   * The stored manifest, or null when there is none this build can read.
   * Checked again on the way out rather than trusted: what was written by
   * another build, or edited by hand, has to clear the same bar as what comes
   * off the network.
   */
  async get(): Promise<LegalManifest | null> {
    return parseLegalManifest(await this.storage.get<unknown>(CACHED_MANIFEST_KEY))
  }

  /**
   * Replaces what is stored, whatever version it names.
   *
   * A manifest that names an older version than the one stored is still the
   * published answer, so a genuine rollback is not fought here. What a
   * rollback cannot do is take a document below what this build shipped with —
   * that floor is applied when the manifest is merged, not when it is stored.
   */
  async set(manifest: LegalManifest): Promise<void> {
    await this.storage.set(CACHED_MANIFEST_KEY, manifest)
  }
}
