import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "../components/ui"
import { settingsStore, AUTO_LOCK_OPTIONS, DEFAULT_AUTO_LOCK_MINUTES } from "~/extension/storage"
import { legalDocUrl, legalLabelKey } from "~/extension/legal"
import type { AppScreen } from "~/extension/types/navigation"

interface SettingsScreenProps {
  onNavigate: (screen: AppScreen) => void
}

// package.jsonのversionがmanifestに反映されるため、そこから取得して二重管理を避ける
const APP_VERSION = chrome.runtime.getManifest().version

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation()
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(DEFAULT_AUTO_LOCK_MINUTES)

  useEffect(() => {
    settingsStore.getAutoLockMinutes().then(setAutoLockMinutes)
  }, [])

  const handleAutoLockChange = async (minutes: number) => {
    setAutoLockMinutes(minutes)
    await settingsStore.setAutoLockMinutes(minutes)
  }

  const formatAutoLockOption = (minutes: number) => {
    if (minutes === 0) return t("settings.autoLockNever")
    if (minutes < 60) return t("settings.autoLockMinutes", { count: minutes })
    const hours = minutes / 60
    return t("settings.autoLockHours", { count: hours })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-primary-600 text-white p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("main")}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-4">
        {/* Security */}
        <Card>
          <CardContent>
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              {t("settings.security")}
            </h2>
            <div className="flex justify-between items-center">
              <div className="flex-1 pr-3">
                <p className="text-sm text-slate-800">{t("settings.autoLock")}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("settings.autoLockDescription")}
                </p>
              </div>
              <select
                value={autoLockMinutes}
                onChange={(e) => handleAutoLockChange(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500">
                {AUTO_LOCK_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatAutoLockOption(option)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Version Info */}
        <Card>
          <CardContent>
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              {t("settings.about")}
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t("settings.version")}</span>
                <span className="text-sm font-mono text-slate-800">{APP_VERSION}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{t("settings.network")}</span>
                <span className="text-sm text-slate-800">{t("wallet.testnet")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legal Info */}
        <Card>
          <CardContent>
            <h2 className="text-sm font-medium text-slate-700 mb-3">
              {t("settings.legal")}
            </h2>
            <div className="space-y-2">
              <a
                href={legalDocUrl("terms")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-between items-center group">
                <span className="text-sm text-slate-600 group-hover:text-primary-600">
                  {t(legalLabelKey("terms"))}
                </span>
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <a
                href={legalDocUrl("privacy")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex justify-between items-center group">
                <span className="text-sm text-slate-600 group-hover:text-primary-600">
                  {t(legalLabelKey("privacy"))}
                </span>
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
