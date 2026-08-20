import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../components/ui"
import { useNetwork } from "~/extension/hooks/useNetwork"
import type { AppScreen } from "~/extension/types/navigation"

const LEGAL_BASE_URL = "https://chaintope.github.io/tapylet"

interface WelcomeScreenProps {
  onNavigate: (screen: AppScreen) => void
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { network } = useNetwork()
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)

  const canProceed = agreedToTerms && agreedToPrivacy

  const handleNavigate = (screen: AppScreen) => {
    if (!canProceed) return
    onNavigate(screen)
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Logo and Title */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{t("wallet.title")}</h1>
        <p className="text-slate-500 text-center mb-2">
          {t("welcome.subtitle")}
        </p>
        <p className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
          {t(network.labelKey)}
        </p>
      </div>

      {/* Consent Checkboxes */}
      <div className="space-y-3 mb-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-600">
            <a
              href={`${LEGAL_BASE_URL}/terms.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
              onClick={(e) => e.stopPropagation()}>
              {t("welcome.termsOfService")}
            </a>
            {t("welcome.agreeToTerms").replace(t("welcome.termsOfService"), "").trim()}
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToPrivacy}
            onChange={(e) => setAgreedToPrivacy(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
          />
          <span className="text-sm text-slate-600">
            <a
              href={`${LEGAL_BASE_URL}/privacy.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
              onClick={(e) => e.stopPropagation()}>
              {t("welcome.privacyPolicy")}
            </a>
            {t("welcome.agreeToPrivacy").replace(t("welcome.privacyPolicy"), "").trim()}
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          fullWidth
          disabled={!canProceed}
          onClick={() => handleNavigate("create")}>
          {t("welcome.createWallet")}
        </Button>
        <Button
          variant="outline"
          fullWidth
          disabled={!canProceed}
          onClick={() => handleNavigate("restore")}>
          {t("welcome.restoreWallet")}
        </Button>
      </div>

      {/* Footer */}
      <p className="text-xs text-slate-400 text-center mt-6">
        Your keys, your coins
      </p>
    </div>
  )
}
