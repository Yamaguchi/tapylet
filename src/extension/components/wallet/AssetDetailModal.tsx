import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button, Input } from "../ui"
import { formatColorId, formatTokenAmount, getExplorerColorUrl } from "@tapylet/core/api"
import { issuedTokenStore, type IssuedToken } from "~/extension/storage"
import { sanitizeUrl, sanitizeImageUrl } from "@tapylet/core/utils/sanitize"
import { burnAsset } from "@tapylet/core/wallet/transaction"
import { walletStorage } from "~/extension/storage"
import { useNetwork } from "~/extension/hooks/useNetwork"
import { parseAndValidateAmount, MAX_COLORED_AMOUNT } from "@tapylet/core/utils/validation"
import type { AssetBalance, Metadata } from "@tapylet/core/api"

const TOKEN_REGISTRY_URL = "https://github.com/chaintope/tapyrus-token-registry/issues/new?template=register-token.yml"

type BurnStep = "idle" | "input" | "confirm" | "burning" | "success" | "error"

interface AssetDetailModalProps {
  colorId: string
  balance: AssetBalance
  metadata: Metadata | null
  address: string
  isOpen: boolean
  onClose: () => void
  onBurnSuccess?: () => void
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  colorId,
  balance,
  metadata,
  address,
  isOpen,
  onClose,
  onBurnSuccess,
}) => {
  const { t } = useTranslation()
  const { network } = useNetwork()
  const [copied, setCopied] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [issuedToken, setIssuedToken] = useState<IssuedToken | null>(null)
  const [showRegistryInfo, setShowRegistryInfo] = useState(false)

  // Burn state
  const [burnStep, setBurnStep] = useState<BurnStep>("idle")
  const [burnAmount, setBurnAmount] = useState("")
  const [burnError, setBurnError] = useState<string | null>(null)
  const [burnTxid, setBurnTxid] = useState<string | null>(null)
  const [originalBalance, setOriginalBalance] = useState<number>(0)

  useEffect(() => {
    if (isOpen && colorId) {
      issuedTokenStore.get(colorId).then(setIssuedToken)
    }
  }, [isOpen, colorId])

  useEffect(() => {
    if (!isOpen) {
      // Reset burn state when modal closes
      setBurnStep("idle")
      setBurnAmount("")
      setBurnError(null)
      setBurnTxid(null)
      setOriginalBalance(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const displayName = metadata?.name ?? formatColorId(colorId)

  // Resolve NFT fields: prefer issuedToken (local), fall back to registry metadata
  const issuer = issuedToken?.metadata.issuer ?? metadata?.issuer
  const isNft = issuedToken?.metadata.tokenType === "nft" || metadata?.tokenType === "nft"
  const nftImage = issuedToken?.metadata.image ?? metadata?.image
  const nftAnimationUrl = issuedToken?.metadata.animation_url ?? metadata?.animation_url
  const nftExternalUrl = issuedToken?.metadata.external_url ?? metadata?.external_url

  const handleCopyColorId = async () => {
    await navigator.clipboard.writeText(colorId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getMetadataJson = () => {
    if (!issuedToken) return ""
    const { tokenType, ...jsonMetadata } = issuedToken.metadata
    return JSON.stringify(jsonMetadata, null, 2)
  }

  const handleBurnStart = () => {
    setBurnStep("input")
    setBurnAmount("")
    setBurnError(null)
    setOriginalBalance(balance.total)
  }

  const handleBurnConfirm = () => {
    setBurnError(null)

    if (!burnAmount.trim()) {
      setBurnError(t("burn.errors.amountRequired"))
      return
    }

    const parsedAmount = parseAndValidateAmount(burnAmount, MAX_COLORED_AMOUNT, metadata?.decimals)
    if (parsedAmount === null) {
      setBurnError(t("burn.errors.invalidAmount"))
      return
    }

    if (parsedAmount <= 0) {
      setBurnError(t("burn.errors.amountGreaterThanZero"))
      return
    }

    if (parsedAmount > balance.total) {
      setBurnError(t("burn.errors.insufficientBalance"))
      return
    }

    setBurnStep("confirm")
  }

  const handleBurnExecute = async () => {
    setBurnStep("burning")
    setBurnError(null)

    try {
      const walletData = await walletStorage.getWallet()
      if (!walletData) {
        throw new Error("Wallet not found")
      }

      const parsedAmount = parseAndValidateAmount(burnAmount, MAX_COLORED_AMOUNT, metadata?.decimals)!

      const result = await burnAsset({
        fromAddress: address,
        amount: parsedAmount,
        colorId,
        mnemonic: walletData.mnemonic,
      })

      setBurnTxid(result.txid)
      setBurnStep("success")
      // Refresh multiple times with delays to catch API update
      onBurnSuccess?.()
      setTimeout(() => onBurnSuccess?.(), 2000)
      setTimeout(() => onBurnSuccess?.(), 5000)
    } catch (err) {
      setBurnError(err instanceof Error ? err.message : "Burn failed")
      setBurnStep("error")
    }
  }

  const handleBurnCancel = () => {
    setBurnStep("idle")
    setBurnAmount("")
    setBurnError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 min-w-0">
            {(metadata?.icon || (isNft && nftImage)) && sanitizeImageUrl(metadata?.icon ?? nftImage) && (
              <img
                src={sanitizeImageUrl(metadata?.icon ?? nftImage)}
                alt={metadata?.name ?? "NFT"}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            )}
            <h2 className="text-lg font-semibold text-slate-800 truncate">
              {displayName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metadata Section */}
        {metadata && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("assetDetail.name")}</span>
              <span className="text-slate-800 font-medium">{metadata.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("assetDetail.symbol")}</span>
              <span className="text-slate-800 font-medium">{metadata.symbol}</span>
            </div>
            {metadata.description && (
              <div className="text-sm">
                <span className="text-slate-500">{t("assetDetail.description")}</span>
                <p className="text-slate-800 mt-1">{metadata.description}</p>
              </div>
            )}
            {metadata.decimals !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t("assetDetail.decimals")}</span>
                <span className="text-slate-800 font-medium">{metadata.decimals}</span>
              </div>
            )}
            {metadata.version && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t("assetDetail.version")}</span>
                <span className="text-slate-800 font-medium">{metadata.version}</span>
              </div>
            )}
            {metadata.website && sanitizeUrl(metadata.website) && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t("assetDetail.website")}</span>
                <a
                  href={sanitizeUrl(metadata.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 underline truncate ml-2"
                >
                  {metadata.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {/* Issuer Info */}
            {issuer && (
              <div className="text-sm">
                <span className="text-slate-500">{t("issue.issuerInfo")}</span>
                <div className="mt-1 space-y-0.5">
                  {issuer.name && (
                    <p className="text-slate-800">{t("issue.issuerName")}: {issuer.name}</p>
                  )}
                  {issuer.url && sanitizeUrl(issuer.url) && (
                    <p className="text-slate-800">
                      <a href={sanitizeUrl(issuer.url)} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline">
                        {issuer.url.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  )}
                  {issuer.email && (
                    <p className="text-slate-800">{issuer.email}</p>
                  )}
                </div>
              </div>
            )}
            {/* NFT Metadata */}
            {isNft && (
              <>
                {nftImage && sanitizeImageUrl(nftImage) && (
                  <div className="text-sm">
                    <span className="text-slate-500">{t("issue.nftImage")}</span>
                    <div className="mt-2">
                      <a href={sanitizeUrl(nftImage)} target="_blank" rel="noopener noreferrer">
                        <img
                          src={sanitizeImageUrl(nftImage)}
                          alt="NFT"
                          className="w-full max-h-48 object-contain rounded-lg bg-slate-100"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                            e.currentTarget.nextElementSibling?.classList.remove("hidden")
                          }}
                        />
                        <span className="hidden text-primary-600 hover:text-primary-700 underline break-all text-xs">
                          {nftImage}
                        </span>
                      </a>
                    </div>
                  </div>
                )}
                {nftAnimationUrl && sanitizeUrl(nftAnimationUrl) && (
                  <div className="text-sm">
                    <span className="text-slate-500">{t("issue.nftAnimationUrl")}</span>
                    <a href={sanitizeUrl(nftAnimationUrl)} target="_blank" rel="noopener noreferrer" className="block text-primary-600 hover:text-primary-700 underline break-all mt-1 text-xs">
                      {nftAnimationUrl}
                    </a>
                  </div>
                )}
                {nftExternalUrl && sanitizeUrl(nftExternalUrl) && (
                  <div className="text-sm">
                    <span className="text-slate-500">{t("issue.nftExternalUrl")}</span>
                    <a href={sanitizeUrl(nftExternalUrl)} target="_blank" rel="noopener noreferrer" className="block text-primary-600 hover:text-primary-700 underline break-all mt-1 text-xs">
                      {nftExternalUrl}
                    </a>
                  </div>
                )}
              </>
            )}
            <div className="border-t border-slate-200 my-2" />
          </div>
        )}

        {/* Balance Section */}
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">{t("assetDetail.balance")}</p>
          <div className="p-3 bg-slate-50 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("assetDetail.total")}</span>
              <span className="text-slate-800 font-semibold">{formatTokenAmount(balance.total, metadata?.decimals)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("wallet.confirmed")}</span>
              <span className="text-slate-800">{formatTokenAmount(balance.confirmed, metadata?.decimals)}</span>
            </div>
            {balance.unconfirmed !== 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t("wallet.unconfirmed")}</span>
                <span className="text-slate-800">
                  {balance.unconfirmed >= 0 ? "+" : ""}{formatTokenAmount(balance.unconfirmed, metadata?.decimals)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Color ID Section */}
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Color ID</p>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs font-mono text-slate-600 break-all">{colorId}</p>
            <button
              onClick={handleCopyColorId}
              className="mt-2 text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? t("common.copied") : t("common.copy")}
            </button>
          </div>
        </div>

        {/* Explorer Link */}
        <a
          href={getExplorerColorUrl(colorId)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mb-3 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {t("assetDetail.viewInExplorer")}
        </a>

        {/* Registry Info for issued tokens */}
        {issuedToken && (
          <div className="mb-3">
            <button
              onClick={() => setShowRegistryInfo(!showRegistryInfo)}
              className="w-full px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t("issue.showRegistryInfo")}
              <svg className={`w-4 h-4 transition-transform ${showRegistryInfo ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRegistryInfo && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-3">
                <p className="text-xs text-slate-600">{t("issue.registryDescription")}</p>

                <div>
                  <p className="text-xs text-slate-500 mb-1">Network</p>
                  <p className="text-sm font-medium text-slate-800">{t(network.labelKey)}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">Color ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-slate-800 break-all flex-1">{colorId}</p>
                    <button
                      onClick={() => handleCopy(colorId, "colorId")}
                      className="text-primary-600 hover:text-primary-700 text-xs shrink-0">
                      {copiedField === "colorId" ? t("common.copied") : t("common.copy")}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 mb-1">Payment Base</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-slate-800 break-all flex-1">{issuedToken.paymentBase}</p>
                    <button
                      onClick={() => handleCopy(issuedToken.paymentBase, "paymentBase")}
                      className="text-primary-600 hover:text-primary-700 text-xs shrink-0">
                      {copiedField === "paymentBase" ? t("common.copied") : t("common.copy")}
                    </button>
                  </div>
                </div>

                {issuedToken.outPoint && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">OutPoint</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-mono text-slate-800 break-all flex-1">{issuedToken.outPoint}</p>
                      <button
                        onClick={() => handleCopy(issuedToken.outPoint!, "outPoint")}
                        className="text-primary-600 hover:text-primary-700 text-xs shrink-0">
                        {copiedField === "outPoint" ? t("common.copied") : t("common.copy")}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500 mb-1">Metadata JSON</p>
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all mb-2 max-h-24 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                    {getMetadataJson()}
                  </pre>
                  <button
                    onClick={() => handleCopy(getMetadataJson(), "json")}
                    className="text-primary-600 hover:text-primary-700 text-xs">
                    {copiedField === "json" ? t("common.copied") : t("issue.copyJson")}
                  </button>
                </div>

                <a
                  href={TOKEN_REGISTRY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full mt-2">
                  <Button variant="outline" fullWidth>
                    {t("issue.openRegistry")}
                  </Button>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Burn Section */}
        {burnStep === "idle" && (
          <div className="mb-3">
            <Button
              variant="outline"
              fullWidth
              onClick={handleBurnStart}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
              {t("burn.button")}
            </Button>
          </div>
        )}

        {/* Burn Input Step */}
        {burnStep === "input" && (
          <div className="mb-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="text-sm font-semibold text-red-800 mb-3">{t("burn.title")}</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("burn.amount")}
              </label>
              <Input
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value.replace(metadata?.decimals ? /[^0-9.]/g : /[^0-9]/g, ""))}
                placeholder={t("burn.amountPlaceholder")}
                type="text"
                inputMode={metadata?.decimals ? "decimal" : "numeric"}
              />
              <p className="text-xs text-slate-500 mt-1">
                {t("burn.available", { amount: formatTokenAmount(balance.total, metadata?.decimals) })}
              </p>
              {metadata?.decimals ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  {t("common.decimalHint", { decimals: metadata.decimals })}
                </p>
              ) : null}
            </div>
            {burnError && <p className="text-sm text-red-500 mb-3">{burnError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={handleBurnCancel}>
                {t("common.cancel")}
              </Button>
              <Button fullWidth onClick={handleBurnConfirm} className="bg-red-600 hover:bg-red-700">
                {t("common.continue")}
              </Button>
            </div>
          </div>
        )}

        {/* Burn Confirm Step */}
        {burnStep === "confirm" && (
          <div className="mb-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="text-sm font-semibold text-red-800 mb-3">{t("burn.confirmTitle")}</h3>
            <div className="p-3 bg-white rounded-lg mb-3">
              <p className="text-xs text-slate-500">{t("burn.amount")}</p>
              <p className="text-lg font-semibold text-slate-800">
                {parseFloat(burnAmount).toLocaleString()}
              </p>
            </div>
            <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-3">
              <p className="text-sm text-red-800 font-medium">{t("burn.warning")}</p>
              <p className="text-sm text-red-700 mt-1">{t("burn.confirmMessage")}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setBurnStep("input")}>
                {t("common.back")}
              </Button>
              <Button fullWidth onClick={handleBurnExecute} className="bg-red-600 hover:bg-red-700">
                {t("burn.button")}
              </Button>
            </div>
          </div>
        )}

        {/* Burn Processing Step */}
        {burnStep === "burning" && (
          <div className="mb-3 p-4 bg-slate-50 rounded-lg text-center">
            <div className="animate-spin w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-600">{t("burn.burning")}</p>
          </div>
        )}

        {/* Burn Success Step */}
        {burnStep === "success" && (
          <div className="mb-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-green-800 mb-1">{t("burn.success")}</p>
              <p className="text-sm text-green-700">
                {t("burn.burnedSuccessfully", { amount: parseFloat(burnAmount).toLocaleString() })}
              </p>
            </div>
            <div className="mt-3 p-3 bg-white rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t("burn.burnedAmount")}</span>
                <span className="text-red-600 font-medium">-{parseFloat(burnAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t("burn.remainingBalance")}</span>
                <span className="text-slate-800 font-semibold">{formatTokenAmount(originalBalance - (parseAndValidateAmount(burnAmount, MAX_COLORED_AMOUNT, metadata?.decimals) ?? 0), metadata?.decimals)}</span>
              </div>
            </div>
            {burnTxid && (
              <p className="text-xs font-mono text-slate-500 break-all mt-3 text-center">TX: {burnTxid}</p>
            )}
            <p className="text-xs text-slate-500 mt-2 text-center">{t("burn.balanceUpdateNote")}</p>
            <Button fullWidth onClick={() => { onBurnSuccess?.(); onClose(); }} className="mt-3">
              {t("common.done")}
            </Button>
          </div>
        )}

        {/* Burn Error Step */}
        {burnStep === "error" && (
          <div className="mb-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-red-800 mb-1">{t("burn.failed")}</p>
              <p className="text-sm text-red-600">{burnError}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" fullWidth onClick={handleBurnCancel}>
                {t("common.cancel")}
              </Button>
              <Button fullWidth onClick={() => setBurnStep("input")}>
                {t("common.tryAgain")}
              </Button>
            </div>
          </div>
        )}

        {/* Close Button */}
        {burnStep === "idle" && (
          <Button variant="outline" fullWidth onClick={onClose}>
            {t("common.close")}
          </Button>
        )}
      </div>
    </div>
  )
}
