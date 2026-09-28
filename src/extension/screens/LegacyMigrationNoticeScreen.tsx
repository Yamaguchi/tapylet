import React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../components/ui"
import type { AppScreen } from "~/extension/types/navigation"

interface LegacyMigrationNoticeScreenProps {
  onNavigate: (screen: AppScreen) => void
}

// Shown exactly once, right after a pre-network-split wallet's mnemonic
// derives separate mainnet/testnet keys (see UnlockScreen and
// ~/extension/storage/migrations.ts#ensureWalletNetworkKeys). The mainnet
// address on screen just changed out from under the user, so this says why
// and where the old one went before showing the new one.
export const LegacyMigrationNoticeScreen: React.FC<LegacyMigrationNoticeScreenProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center">
      <h1 className="text-lg font-semibold text-slate-800 mb-2">
        {t("legacyMigrationNotice.title")}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {t("legacyMigrationNotice.description")}
      </p>
      <div className="w-full max-w-xs space-y-3">
        <Button fullWidth onClick={() => onNavigate("settings")}>
          {t("legacyMigrationNotice.openSettings")}
        </Button>
        <Button variant="secondary" fullWidth onClick={() => onNavigate("main")}>
          {t("legacyMigrationNotice.continueButton")}
        </Button>
      </div>
    </div>
  )
}
