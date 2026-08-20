// Announces a revision of the terms of service or the privacy policy before it
// takes effect.
//
// The terms of service undertake to give notice of the content of a change and
// of when it takes effect, by the time it takes effect (section 7). This banner
// is that notice, so it always carries all three: what changes, when, and a
// link to the new text.

import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  changesFor,
  formatEffectiveFrom,
  formatVersion,
  legalDocUrl,
  legalLabelKey,
  upcomingDocs,
  type LegalDocId
} from "~/extension/legal"
import { legalNoticeStore } from "~/extension/storage"

export const LegalUpdateNotice: React.FC = () => {
  const { t, i18n } = useTranslation()
  // Undefined until the record has been read. Drawing before then would flash
  // a banner the user has already dismissed on every launch.
  const [dismissed, setDismissed] = useState<Partial<
    Record<LegalDocId, string>
  > | null>(null)

  useEffect(() => {
    let cancelled = false
    legalNoticeStore
      .getDismissed()
      // Showing a banner that was dismissed is a nuisance; hiding one that was
      // not would drop the notice, so an unreadable store shows it.
      .catch(() => ({}))
      .then((stored) => {
        if (!cancelled) setDismissed(stored)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (dismissed === null) return null

  const pending = upcomingDocs().filter(
    ({ id, upcoming }) => dismissed[id] !== formatVersion(upcoming.version)
  )
  if (pending.length === 0) return null

  const handleDismiss = async (id: LegalDocId, version: string) => {
    setDismissed((current) => ({ ...current, [id]: version }))
    try {
      await legalNoticeStore.dismiss(id, version)
    } catch (err) {
      // The banner stays hidden for this session and comes back on the next
      // launch. Nothing else depends on the record.
      console.error("Failed to store the dismissed notice:", err)
    }
  }

  return (
    <>
      {pending.map(({ id, upcoming }) => {
        const label = t(legalLabelKey(id))
        const changes = changesFor(upcoming.changes, i18n.language)
        return (
          <section
            className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            key={id}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">
                {t("legal.notice.title", {
                  doc: label,
                  date: formatEffectiveFrom(
                    upcoming.effectiveFrom,
                    i18n.language
                  )
                })}
              </p>
              <button
                className="-mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center text-lg text-amber-700"
                aria-label={t("legal.notice.close")}
                onClick={() =>
                  handleDismiss(id, formatVersion(upcoming.version))
                }>
                ×
              </button>
            </div>
            {changes.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {changes.map((change, index) => (
                  // The list has no identity of its own; two entries may read
                  // the same, so its position is the only stable key.
                  <li key={index}>{change}</li>
                ))}
              </ul>
            )}
            <a
              href={legalDocUrl(id, upcoming.version)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-bold underline">
              {t("legal.notice.read", { doc: label })}
            </a>
          </section>
        )
      })}
    </>
  )
}
