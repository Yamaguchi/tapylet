// Which announced version of each legal document the user has dismissed the
// notice banner for.
//
// A banner shown on every launch until the change takes effect stops being read
// long before then. Dismissing it hides that version only, so the next
// announcement brings the banner back.

import type { KeyValueStore } from "@tapylet/core/storage/types"

import {
  formatVersion,
  LEGAL_DOC_IDS,
  parseVersion,
  type LegalDocId,
} from "~/extension/legal"

const DISMISSED_NOTICES_KEY = "legal_notice_dismissed"

export class LegalNoticeStore {
  // Dismissals are written one at a time. Two banners closed in quick
  // succession would otherwise both read the record before either wrote it,
  // and the second write would drop the first one's entry — bringing that
  // banner back on the next launch.
  private pending: Promise<void> = Promise.resolve()

  constructor(private storage: KeyValueStore) {}

  /** The dismissed versions, empty when nothing has been dismissed. */
  async getDismissed(): Promise<Partial<Record<LegalDocId, string>>> {
    const stored = await this.storage.get<Record<string, unknown>>(
      DISMISSED_NOTICES_KEY,
    )
    if (!stored || typeof stored !== "object") return {}

    const dismissed: Partial<Record<LegalDocId, string>> = {}
    for (const id of LEGAL_DOC_IDS) {
      const version = parseVersion(stored[id])
      // Kept in the written form, which is what the banner compares against.
      if (version) dismissed[id] = formatVersion(version)
    }
    return dismissed
  }

  dismiss(id: LegalDocId, version: string): Promise<void> {
    // A failed write does not hold up the ones behind it: the banner it belongs
    // to simply comes back.
    this.pending = this.pending.catch(() => {}).then(async () => {
      const dismissed = await this.getDismissed()
      await this.storage.set(DISMISSED_NOTICES_KEY, {
        ...dismissed,
        [id]: version,
      })
    })
    return this.pending
  }
}
