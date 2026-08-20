// Asks for consent again after the terms of service or the privacy policy have
// been revised. Sits in front of the unlock screen, so an existing wallet
// cannot be used until the user has responded.
//
// What is asked differs per document: the terms of service are a promise
// between the user and the company, so they ask for agreement; the privacy
// policy is a notice from the company, so it asks to be acknowledged. One
// checkbox per document rather than a combined one — a combined checkbox would
// take agreement to something that is only a notice.
//
// There is no way past this screen other than responding. Sending the user back
// to the welcome screen would put "create a new wallet" within reach of someone
// who already has one, and creating one overwrites the wallet that is stored.

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  changesFor,
  consentLabelKeys,
  legalDoc,
  legalDocUrl,
  legalLabelKey,
  type LegalDocId
} from "~/extension/legal"

import { Button } from "../components/ui"

interface ConsentUpdateScreenProps {
  /** The documents that have to be agreed to (acknowledged) again. */
  docs: LegalDocId[]
  onAgree: () => void
}

export const ConsentUpdateScreen: React.FC<ConsentUpdateScreenProps> = ({
  docs,
  onAgree
}) => {
  const { t, i18n } = useTranslation()
  const [checked, setChecked] = useState<LegalDocId[]>([])
  const canProceed = docs.every((id) => checked.includes(id))

  const labels = docs
    .map((id) => t(legalLabelKey(id)))
    .join(t("legal.separator"))
  // The wording of the button follows what the documents are, so that it stays
  // right whichever of them is being revised.
  const actionLabel = docs.some((id) => legalDoc(id).kind === "agree")
    ? t("legal.update.agreeAction")
    : t("legal.update.acknowledgeAction")

  const toggle = (id: LegalDocId, on: boolean) =>
    setChecked((current) =>
      on ? [...current, id] : current.filter((x) => x !== id)
    )

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col justify-center py-6">
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          {t("legal.update.title", { docs: labels })}
        </h1>
        <p className="text-sm text-slate-500">
          {t("legal.update.description", { docs: labels })}
        </p>

        {docs.map((id) => {
          const changes = changesFor(legalDoc(id).changes, i18n.language)
          if (changes.length === 0) return null
          return (
            <div
              className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"
              key={id}>
              <p className="mb-1 font-bold text-slate-700">
                {t("legal.update.changesTitle", { doc: t(legalLabelKey(id)) })}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {changes.map((change, index) => (
                  // The list has no identity of its own; two entries may read
                  // the same, so its position is the only stable key.
                  <li key={index}>{change}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="space-y-3 mb-4">
        {docs.map((id) => (
          <label className="flex items-start gap-3 cursor-pointer" key={id}>
            <input
              type="checkbox"
              checked={checked.includes(id)}
              onChange={(e) => toggle(id, e.target.checked)}
              className="mt-0.5 w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-600">
              {t(consentLabelKeys(id).prefix)}
              <a
                href={legalDocUrl(id)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
                onClick={(e) => e.stopPropagation()}>
                {t(legalLabelKey(id))}
              </a>
              {t(consentLabelKeys(id).suffix)}
            </span>
          </label>
        ))}
      </div>

      <Button fullWidth disabled={!canProceed} onClick={onAgree}>
        {actionLabel}
      </Button>
    </div>
  )
}
