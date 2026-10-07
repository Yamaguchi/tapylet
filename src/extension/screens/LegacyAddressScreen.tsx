import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Card, CardContent, Loading } from "../components/ui"
import { AddressDisplay, SendModal } from "../components/wallet"
import { NetworkId } from "@tapylet/core/wallet"
import {
  getAllBalances,
  formatTpc,
  formatTokenAmount,
  formatColorId,
  getTokenMetadataBatch,
  Metadata,
  type AllBalances,
} from "@tapylet/core/api"
import { pendingTxStore } from "~/extension/storage"
import { useNetwork } from "~/extension/hooks/useNetwork"
import type { AppScreen } from "~/extension/types/navigation"

interface LegacyAddressScreenProps {
  legacyMainnetAddress: string
  // Where funds left at the legacy address are expected to go. Null when the
  // mainnet key could not be derived, in which case nothing is prefilled.
  newMainnetAddress: string | null
  onNavigate: (screen: AppScreen) => void
}

// The pre-network-split address was always mainnet-formatted (see
// @tapylet/core/wallet/hdwallet#getKeyPairFromLegacyMainnetWallet), so its
// balance can only be read while the panel is pointed at the mainnet
// explorer. Rather than juggling a second, temporary network configuration,
// this screen simply asks for mainnet to be selected first.
export const LegacyAddressScreen: React.FC<LegacyAddressScreenProps> = ({
  legacyMainnetAddress,
  newMainnetAddress,
  onNavigate,
}) => {
  const { t } = useTranslation()
  const { network, switchNetwork } = useNetwork()
  const [balances, setBalances] = useState<AllBalances | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tokenMetadata, setTokenMetadata] = useState<Map<string, Metadata>>(new Map())
  const [showSendModal, setShowSendModal] = useState(false)

  const isOnMainnet = network.key === "mainnet"

  const refresh = useCallback(async () => {
    if (!isOnMainnet) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const allBal = await getAllBalances(legacyMainnetAddress)
      setBalances(allBal)
      if (allBal.assets.length > 0) {
        const meta = await getTokenMetadataBatch(allBal.assets.map((a) => a.colorId))
        setTokenMetadata(meta)
      }
    } catch (err) {
      console.error("Failed to load the legacy address balance:", err)
      setLoadError(t("wallet.failedToLoad"))
    } finally {
      setIsLoading(false)
    }
  }, [isOnMainnet, legacyMainnetAddress, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex flex-col h-full">
      <div className="bg-slate-700 text-white p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("settings")}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">{t("legacyAddress.title")}</h1>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        <p className="text-sm text-slate-600">{t("legacyAddress.description")}</p>

        <Card>
          <CardContent>
            <p className="text-sm font-medium text-slate-700 mb-3">{t("legacyAddress.address")}</p>
            <AddressDisplay address={legacyMainnetAddress} showFull />
          </CardContent>
        </Card>

        {!isOnMainnet ? (
          <Card>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">{t("legacyAddress.switchToMainnet")}</p>
              <Button fullWidth onClick={() => switchNetwork("mainnet").catch((err) => console.error(err))}>
                {t("legacyAddress.switchButton")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm font-medium text-slate-700 mb-3">{t("wallet.totalBalance")}</p>
              {isLoading ? (
                <Loading size="sm" />
              ) : loadError ? (
                <p className="text-sm text-red-500">{loadError}</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-800">
                    {formatTpc(balances?.tpc.total ?? 0)} TPC
                  </p>
                  {balances && balances.assets.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {balances.assets.map((asset) => {
                        const meta = tokenMetadata.get(asset.colorId)
                        return (
                          <div
                            key={asset.colorId}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-xs font-mono text-slate-600 truncate">
                              {meta ? `${meta.name} (${meta.symbol})` : formatColorId(asset.colorId)}
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              {formatTokenAmount(asset.total, meta?.decimals)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <Button fullWidth className="mt-4" onClick={() => setShowSendModal(true)}>
                    {t("legacyAddress.sendButton")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <SendModal
        address={legacyMainnetAddress}
        networkId={NetworkId.TAPYRUS_API}
        fromLegacyMainnetWallet
        defaultToAddress={newMainnetAddress ?? undefined}
        tpcBalance={balances?.tpc ?? { confirmed: 0, unconfirmed: 0, total: 0 }}
        assets={balances?.assets ?? []}
        tokenMetadata={tokenMetadata}
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={async (txid, amount, toAddress, colorId) => {
          await pendingTxStore.add({ txid, amount, toAddress, timestamp: Date.now(), colorId })
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            await refresh()
          }
        }}
      />
    </div>
  )
}
