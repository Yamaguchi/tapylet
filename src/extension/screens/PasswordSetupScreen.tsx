import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Input } from "../components/ui"
import { buildWalletData } from "~/extension/wallet/buildWalletData"
import { walletStorage } from "~/extension/storage"
import type { AppScreen } from "~/extension/types/navigation"
import type { NetworkWalletKeys } from "@tapylet/core/types/wallet"

interface PasswordSetupScreenProps {
  mnemonic: string
  /** True when the mnemonic was typed in on the restore screen. */
  restored: boolean
  onNavigate: (screen: AppScreen) => void
  onWalletCreated: (
    networks: Record<number, NetworkWalletKeys>,
    legacyMainnetAddress: string | null,
  ) => void
}

export const PasswordSetupScreen: React.FC<PasswordSetupScreenProps> = ({
  mnemonic,
  restored,
  onNavigate,
  onWalletCreated,
}) => {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateWallet = async () => {
    setError(null)

    // Validation
    if (password.length < 8) {
      setError(t("passwordSetup.errors.minLength"))
      return
    }

    if (password !== confirmPassword) {
      setError(t("passwordSetup.errors.noMatch"))
      return
    }

    setIsCreating(true)

    try {
      const walletData = await buildWalletData(mnemonic, { restored })

      // Set password and save wallet
      await walletStorage.setPassword(password)
      await walletStorage.saveWallet(walletData)

      onWalletCreated(walletData.networks, walletData.legacyMainnetAddress ?? null)
      onNavigate("main")
    } catch (err) {
      console.error("Failed to create wallet:", err)
      setError(t("passwordSetup.errors.minLength"))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          {t("passwordSetup.title")}
        </h1>
        <p className="text-sm text-slate-500">
          {t("passwordSetup.subtitle")}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-4">
        <Input
          label={t("passwordSetup.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("passwordSetup.password")}
          showPasswordToggle
        />

        <Input
          label={t("passwordSetup.confirmPassword")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t("passwordSetup.confirmPassword")}
          showPasswordToggle
        />

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3 mt-6">
        <Button
          fullWidth
          loading={isCreating}
          disabled={password.length < 8 || password !== confirmPassword}
          onClick={handleCreateWallet}>
          {t("passwordSetup.setPassword")}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={isCreating}
          onClick={() => onNavigate("mnemonic-confirm")}>
          {t("common.back")}
        </Button>
      </div>
    </div>
  )
}
