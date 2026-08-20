import React, { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button, Card, CardContent } from "../components/ui"
import { AddressDisplay, ReceiveModal, SendModal, PendingTransactions, AssetDetailModal, IssueModal } from "../components/wallet"
import { walletStorage } from "~/extension/storage"
import { pendingTxStore, type PendingTransaction } from "~/extension/storage"
import { issuedTokenStore } from "~/extension/storage"
import { getAllBalances, formatTpc, formatTokenAmount, getTransactionInfo, formatColorId, getExplorerColorUrl, getTokenMetadataBatch, Metadata, type AllBalances } from "@tapylet/core/api"
import { sanitizeImageUrl } from "@tapylet/core/utils/sanitize"
import { useNetwork } from "~/extension/hooks/useNetwork"
import { getNetwork } from "~/extension/constants/network"
import type { AppScreen } from "~/extension/types/navigation"

interface MainWalletScreenProps {
  address: string
  onNavigate: (screen: AppScreen) => void
}

export const MainWalletScreen: React.FC<MainWalletScreenProps> = ({
  address,
  onNavigate,
}) => {
  const { t } = useTranslation()
  const { network } = useNetwork()
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [balances, setBalances] = useState<AllBalances | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [pendingTxs, setPendingTxs] = useState<PendingTransaction[]>([])
  const [tokenMetadata, setTokenMetadata] = useState<Map<string, Metadata>>(new Map())
  const [selectedAssetColorId, setSelectedAssetColorId] = useState<string | null>(null)

  const handleLock = () => {
    walletStorage.lock()
    onNavigate("unlock")
  }

  const refreshData = useCallback(async () => {
    // A refresh started before a network switch must not finish after it: its
    // results describe the previous chain, and pendingTxStore writes would
    // land in the new network's namespace.
    const startedOn = getNetwork().id
    const isStale = () => getNetwork().id !== startedOn

    // Check and remove confirmed transactions
    const txs = await pendingTxStore.getAll()
    for (const tx of txs) {
      if (isStale()) return
      try {
        const info = await getTransactionInfo(tx.txid)
        // Checked again after the request: the switch can land while it is in
        // flight, and the removal below would then write to the new network's
        // namespace.
        if (isStale()) return
        if (info.status.confirmed) {
          await pendingTxStore.remove(tx.txid)
        }
      } catch {
        // Transaction not found or error, keep in pending
      }
    }

    // Fetch balance and pending txs together
    const [allBal, updatedTxs] = await Promise.all([
      getAllBalances(address).catch((err) => {
        console.error("Failed to fetch balance:", err)
        return null
      }),
      pendingTxStore.getAll(),
    ])

    if (isStale()) return

    // Update state together
    if (allBal) {
      setBalances(allBal)
      setBalanceError(null)
      // Fetch token metadata for colored coins
      if (allBal.assets.length > 0) {
        const colorIds = allBal.assets.map((a) => a.colorId)
        // Fetch both registry metadata and local issued tokens
        const [registryMeta, issuedTokens] = await Promise.all([
          getTokenMetadataBatch(colorIds),
          issuedTokenStore.getAll(),
        ])
        if (isStale()) return
        // Merge: registry metadata takes priority, fall back to local
        const mergedMeta = new Map<string, Metadata>(registryMeta)
        for (const issued of issuedTokens) {
          if (!mergedMeta.has(issued.colorId)) {
            mergedMeta.set(issued.colorId, new Metadata(issued.metadata))
          }
        }
        setTokenMetadata(mergedMeta)
      }
    } else {
      setBalanceError(t("wallet.failedToLoad"))
    }
    setPendingTxs(updatedTxs)
    setIsLoadingBalance(false)
  }, [address, t])

  useEffect(() => {
    refreshData()
    const interval = setInterval(refreshData, 60000)
    return () => clearInterval(interval)
  }, [refreshData])

  return (
    <div className="flex flex-col h-full">
      {/* Header — tinted with the selected network's colour so the network in
          use is visible without reading the badge. */}
      <div className={`${network.headerClass} text-white p-6 pb-12`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4"
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
            <span className="font-medium">{t("wallet.title")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/20 px-2 py-1 rounded">
              {t(network.labelKey)}
            </span>
            <button
              onClick={() => onNavigate("settings")}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Settings">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <button
              onClick={handleLock}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Lock wallet">
              <svg
                className="w-5 h-5"
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
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="text-center">
          <p className="text-white/60 text-sm mb-1">{t("wallet.totalBalance")}</p>
          {isLoadingBalance ? (
            <p className="text-3xl font-bold animate-pulse">...</p>
          ) : balanceError ? (
            <p className="text-lg font-bold">{balanceError}</p>
          ) : (
            <>
              <p className="text-3xl font-bold">
                {formatTpc(balances?.tpc.total ?? 0)} TPC
              </p>
              {balances && balances.tpc.unconfirmed !== 0 && balances.tpc.confirmed !== 0 && (
                <div className="mt-2 text-xs text-white/70 flex justify-center gap-4">
                  <span>{t("wallet.confirmed")}: {formatTpc(balances.tpc.confirmed)}</span>
                  <span>{t("wallet.unconfirmed")}: {balances.tpc.unconfirmed >= 0 ? "+" : ""}{formatTpc(balances.tpc.unconfirmed)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 -mt-6">
        {/* Address Card */}
        <Card className="mb-4">
          <CardContent>
            <p className="text-sm font-medium text-slate-700 mb-3">
              {t("wallet.yourAddress")}
            </p>
            <AddressDisplay address={address} showFull />
          </CardContent>
        </Card>

        {/* Assets */}
        {balances && balances.assets.length > 0 && (
          <Card className="mb-4">
            <CardContent>
              <p className="text-sm font-medium text-slate-700 mb-3">
                {t("wallet.assets")}
              </p>
              <div className="space-y-2">
                {balances.assets.map((asset) => {
                  const meta = tokenMetadata.get(asset.colorId)
                  return (
                    <button
                      key={asset.colorId}
                      onClick={() => setSelectedAssetColorId(asset.colorId)}
                      className="w-full flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-left">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {meta?.icon && sanitizeImageUrl(meta.icon) && (
                          <img
                            src={sanitizeImageUrl(meta.icon)}
                            alt={meta.name}
                            className="w-6 h-6 rounded-full flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          {meta ? (
                            <span className="text-sm font-medium text-slate-800 block truncate">
                              {meta.name}
                              <span className="text-slate-500 ml-1">({meta.symbol})</span>
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-slate-600 block truncate">
                              {formatColorId(asset.colorId)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {formatTokenAmount(asset.total, meta?.decimals)}
                        </span>
                        {asset.unconfirmed !== 0 && asset.confirmed !== 0 && (
                          <span className="text-xs text-slate-500 ml-1">
                            ({asset.unconfirmed >= 0 ? "+" : ""}{formatTokenAmount(asset.unconfirmed, meta?.decimals)})
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => setShowSendModal(true)}>
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            {t("common.send")}
          </Button>
          <Button variant="outline" onClick={() => setShowReceiveModal(true)}>
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t("common.receive")}
          </Button>
          <Button variant="outline" onClick={() => setShowIssueModal(true)}>
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("common.issue")}
          </Button>
        </div>

        {/* Pending Transactions Banner */}
        {pendingTxs.length > 0 && (
          <button
            onClick={() => setShowPendingModal(true)}
            className="w-full mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between hover:bg-orange-100 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-orange-700">
                {t("pending.pendingCount", { count: pendingTxs.length })}
              </span>
            </div>
            <svg
              className="w-4 h-4 text-orange-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 pt-0">
        <p className="text-xs text-slate-400 text-center">
          {t("wallet.connectedTo", { network: t(network.labelKey) })}
        </p>
      </div>

      {/* Receive Modal */}
      <ReceiveModal
        address={address}
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
      />

      {/* Send Modal */}
      <SendModal
        address={address}
        tpcBalance={balances?.tpc ?? { confirmed: 0, unconfirmed: 0, total: 0 }}
        assets={balances?.assets ?? []}
        tokenMetadata={tokenMetadata}
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={async (txid: string, amount: number, toAddress: string, colorId?: string) => {
          await pendingTxStore.add({
            txid,
            amount,
            toAddress,
            timestamp: Date.now(),
            colorId,
          })
          // Retry refreshing until API reflects the new transaction
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            await refreshData()
          }
        }}
      />

      {/* Issue Modal */}
      <IssueModal
        address={address}
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onSuccess={async () => {
          // Retry refreshing until API reflects the new transaction
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            await refreshData()
          }
        }}
      />

      {/* Asset Detail Modal */}
      {selectedAssetColorId && balances && (() => {
        const asset = balances.assets.find((a) => a.colorId === selectedAssetColorId)
        if (!asset) return null
        return (
          <AssetDetailModal
            colorId={selectedAssetColorId}
            balance={asset}
            metadata={tokenMetadata.get(selectedAssetColorId) ?? null}
            address={address}
            isOpen={true}
            onClose={() => setSelectedAssetColorId(null)}
            onBurnSuccess={() => {
              refreshData()
            }}
          />
        )
      })()}

      {/* Pending Transactions Modal */}
      <PendingTransactions
        transactions={pendingTxs}
        tokenMetadata={tokenMetadata}
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
      />
    </div>
  )
}
