import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Input } from "../components/ui"
import { walletStorage } from "~/extension/storage"
import { ensureWalletNetworkKeys } from "~/extension/storage/migrations"
import type { AppScreen } from "~/extension/types/navigation"
import type { NetworkWalletKeys } from "@tapylet/core/types/wallet"

interface UnlockScreenProps {
  onNavigate: (screen: AppScreen) => void
  onUnlock: (
    networks: Record<number, NetworkWalletKeys>,
    legacyMainnetAddress: string | null,
  ) => void
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({
  onNavigate,
  onUnlock,
}) => {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isUnlocking, setIsUnlocking] = useState(false)

  const handleUnlock = async () => {
    setError(null)

    if (!password) {
      setError(t("unlock.errors.incorrectPassword"))
      return
    }

    setIsUnlocking(true)

    try {
      const success = await walletStorage.unlock(password)

      if (!success) {
        setError(t("unlock.errors.incorrectPassword"))
        setIsUnlocking(false)
        return
      }

      const wallet = await walletStorage.getWallet()

      if (!wallet) {
        setError(t("unlock.errors.incorrectPassword"))
        setIsUnlocking(false)
        return
      }

      const { wallet: migrated, changed, migratedFromLegacyFormat } = await ensureWalletNetworkKeys(wallet)
      if (changed) {
        await walletStorage.saveWallet(migrated)
      }

      onUnlock(migrated.networks, migrated.legacyMainnetAddress ?? null)
      onNavigate(migratedFromLegacyFormat ? "legacy-migration-notice" : "main")
    } catch (err) {
      console.error("Failed to unlock:", err)
      setError(t("unlock.errors.incorrectPassword"))
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password) {
      handleUnlock()
    }
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Logo and Title */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{t("unlock.title")}</h1>
        <p className="text-slate-500 text-center mb-8">
          {t("unlock.subtitle")}
        </p>

        <div className="w-full space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("unlock.password")}
            showPasswordToggle
            autoFocus
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <Button fullWidth loading={isUnlocking} onClick={handleUnlock}>
        {t("unlock.unlock")}
      </Button>
    </div>
  )
}
