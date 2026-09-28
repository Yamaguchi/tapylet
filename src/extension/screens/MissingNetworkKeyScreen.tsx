import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../components/ui"
import type { NetworkConfig } from "~/extension/constants/network"
import type { AppScreen } from "~/extension/types/navigation"

interface MissingNetworkKeyScreenProps {
  network: NetworkConfig
  onNavigate: (screen: AppScreen) => void
  onRegenerate: () => Promise<void>
}

// Shown instead of the main wallet screen when this network has no key yet —
// migration ran but failed to derive one (see
// ~/extension/storage/migrations.ts#ensureWalletNetworkKeys). Offers a retry
// rather than leaving the panel stuck, since the failure is typically
// transient (e.g. storage was briefly unavailable).
export const MissingNetworkKeyScreen: React.FC<MissingNetworkKeyScreenProps> = ({
  network,
  onNavigate,
  onRegenerate,
}) => {
  const { t } = useTranslation()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setError(null)
    try {
      await onRegenerate()
    } catch (err) {
      console.error("Failed to generate the network key:", err)
      setError(t("missingNetworkKey.error"))
    } finally {
      setIsRegenerating(false)
    }
  }

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-800 mb-2">
        {t("missingNetworkKey.title", { network: t(network.labelKey) })}
      </h1>
      <p className="text-sm text-slate-500 mb-6">{t("missingNetworkKey.description")}</p>
      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
      <div className="w-full max-w-xs space-y-3">
        <Button fullWidth loading={isRegenerating} onClick={handleRegenerate}>
          {t("missingNetworkKey.regenerate")}
        </Button>
        <Button variant="secondary" fullWidth disabled={isRegenerating} onClick={() => onNavigate("settings")}>
          {t("common.settings")}
        </Button>
      </div>
    </div>
  )
}
