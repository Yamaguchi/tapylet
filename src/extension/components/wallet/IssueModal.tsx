import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Input } from "../ui"
import { issueToken, type TokenType, type MetadataFields } from "@tapylet/core/wallet/issuance"
import { issuedTokenStore } from "~/extension/storage"
import { walletStorage } from "~/extension/storage"
import { useNetwork } from "~/extension/hooks/useNetwork"
import { formatColorId } from "@tapylet/core/api"
import { parseAndValidateAmount, MAX_COLORED_AMOUNT } from "@tapylet/core/utils/validation"

interface IssueModalProps {
  address: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type IssueStep = "input" | "confirm" | "issuing" | "success"

const TOKEN_REGISTRY_URL = "https://github.com/chaintope/tapyrus-token-registry/issues/new?template=register-token.yml"

export const IssueModal: React.FC<IssueModalProps> = ({
  address,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const { network } = useNetwork()
  const [step, setStep] = useState<IssueStep>("input")
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [tokenType, setTokenType] = useState<TokenType>("reissuable")
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [decimals, setDecimals] = useState("0")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("")
  const [website, setWebsite] = useState("")
  const [issuerName, setIssuerName] = useState("")
  const [issuerUrl, setIssuerUrl] = useState("")
  const [issuerEmail, setIssuerEmail] = useState("")
  const [amount, setAmount] = useState("")

  // NFT metadata state
  const [nftImage, setNftImage] = useState("")
  const [nftAnimationUrl, setNftAnimationUrl] = useState("")
  const [nftExternalUrl, setNftExternalUrl] = useState("")

  // Result state
  const [resultColorId, setResultColorId] = useState("")
  const [resultTxid, setResultTxid] = useState("")
  const [resultPaymentBase, setResultPaymentBase] = useState("")
  const [resultOutPoint, setResultOutPoint] = useState("")
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const resetState = () => {
    setStep("input")
    setError(null)
    setTokenType("reissuable")
    setName("")
    setSymbol("")
    setDecimals("0")
    setDescription("")
    setIcon("")
    setWebsite("")
    setIssuerName("")
    setIssuerUrl("")
    setIssuerEmail("")
    setAmount("")
    setNftImage("")
    setNftAnimationUrl("")
    setNftExternalUrl("")
    setResultColorId("")
    setResultTxid("")
    setResultPaymentBase("")
    setResultOutPoint("")
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const buildMetadata = (): MetadataFields => {
    const metadata: MetadataFields = {
      version: "1.0",
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      tokenType,
    }

    const dec = parseInt(decimals, 10)
    if (!isNaN(dec) && dec >= 0 && dec <= 18) {
      metadata.decimals = dec
    }

    if (description.trim()) {
      metadata.description = description.trim()
    }

    if (icon.trim()) {
      metadata.icon = icon.trim()
    }

    if (website.trim()) {
      metadata.website = website.trim()
    }

    if (issuerName.trim() || issuerUrl.trim() || issuerEmail.trim()) {
      metadata.issuer = {}
      if (issuerName.trim()) metadata.issuer.name = issuerName.trim()
      if (issuerUrl.trim()) metadata.issuer.url = issuerUrl.trim()
      if (issuerEmail.trim()) metadata.issuer.email = issuerEmail.trim()
    }

    // NFT-specific metadata
    if (tokenType === "nft") {
      if (nftImage.trim()) {
        metadata.image = nftImage.trim()
      }
      if (nftAnimationUrl.trim()) {
        metadata.animation_url = nftAnimationUrl.trim()
      }
      if (nftExternalUrl.trim()) {
        metadata.external_url = nftExternalUrl.trim()
      }
    }

    return metadata
  }

  const handleConfirm = () => {
    setError(null)

    // Validate required fields
    if (!name.trim()) {
      setError(t("issue.errors.nameRequired"))
      return
    }
    if (name.trim().length > 64) {
      setError(t("issue.errors.nameTooLong"))
      return
    }

    if (!symbol.trim()) {
      setError(t("issue.errors.symbolRequired"))
      return
    }
    if (symbol.trim().length > 12) {
      setError(t("issue.errors.symbolTooLong"))
      return
    }

    // Skip amount validation for NFT (fixed to 1)
    if (tokenType !== "nft") {
      if (!amount.trim()) {
        setError(t("issue.errors.amountRequired"))
        return
      }

      const parsedAmount = parseAndValidateAmount(amount, MAX_COLORED_AMOUNT)
      if (parsedAmount === null || parsedAmount <= 0) {
        setError(t("issue.errors.invalidAmount"))
        return
      }
    }

    setStep("confirm")
  }

  const handleIssue = async () => {
    setStep("issuing")
    setError(null)

    try {
      const walletData = await walletStorage.getWallet()
      if (!walletData) {
        throw new Error("Wallet not found")
      }

      const metadata = buildMetadata()
      const parsedAmount = tokenType === "nft" ? 1 : (parseAndValidateAmount(amount, MAX_COLORED_AMOUNT) ?? 0)

      const result = await issueToken({
        tokenType,
        amount: parsedAmount,
        metadata,
        mnemonic: walletData.mnemonic,
        fromAddress: address,
      })

      // Save to local storage
      await issuedTokenStore.add({
        colorId: result.colorId,
        metadata,
        paymentBase: result.paymentBase,
        txid: result.txid,
        timestamp: Date.now(),
        outPoint: result.outPoint,
      })

      setResultColorId(result.colorId)
      setResultTxid(result.txid)
      setResultPaymentBase(result.paymentBase)
      setResultOutPoint(result.outPoint ?? "")
      setStep("success")
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Issuance failed")
      setStep("input")
    }
  }

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const getMetadataJson = () => {
    const metadata = buildMetadata()
    // Remove tokenType from the JSON as it's not part of TIP-0020
    const { tokenType: _, ...jsonMetadata } = metadata
    return JSON.stringify(jsonMetadata, null, 2)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">
              {t("issue.title")}
            </h2>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Input Step */}
          {step === "input" && (
            <>
              {/* Token Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t("issue.tokenType")}
                </label>
                <div className="space-y-2">
                  {(["reissuable", "non_reissuable", "nft"] as TokenType[]).map((type) => (
                    <label
                      key={type}
                      className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                        tokenType === type
                          ? "border-primary-500 bg-primary-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}>
                      <input
                        type="radio"
                        name="tokenType"
                        value={type}
                        checked={tokenType === type}
                        onChange={(e) => {
                          const newType = e.target.value as TokenType
                          setTokenType(newType)
                          if (newType === "nft") {
                            setAmount("1")
                            setDecimals("0")
                          }
                        }}
                        className="mt-0.5 mr-3"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {t(`issue.types.${type}.name`)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t(`issue.types.${type}.description`)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("issue.name")} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("issue.namePlaceholder")}
                    maxLength={64}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("issue.symbol")} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder={t("issue.symbolPlaceholder")}
                    maxLength={12}
                  />
                </div>
                {tokenType !== "nft" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t("issue.amount")} <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder={t("issue.amountPlaceholder")}
                      type="text"
                      inputMode="numeric"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {t("issue.description")}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("issue.descriptionPlaceholder")}
                    maxLength={256}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
                <Input
                  label={t("issue.icon")}
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="https://..."
                />
                <Input
                  label={t("issue.website")}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                />

                {/* Issuer Info (collapsible) */}
                <details className="border border-slate-200 rounded-lg">
                  <summary className="px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer">
                    {t("issue.issuerInfo")}
                  </summary>
                  <div className="px-3 pb-3 space-y-3">
                    <Input
                      label={t("issue.issuerName")}
                      value={issuerName}
                      onChange={(e) => setIssuerName(e.target.value)}
                    />
                    <Input
                      label={t("issue.issuerUrl")}
                      value={issuerUrl}
                      onChange={(e) => setIssuerUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <Input
                      label={t("issue.issuerEmail")}
                      value={issuerEmail}
                      onChange={(e) => setIssuerEmail(e.target.value)}
                      type="email"
                    />
                  </div>
                </details>

                {/* NFT Metadata (only for NFT type) */}
                {tokenType === "nft" && (
                  <details className="border border-slate-200 rounded-lg" open>
                    <summary className="px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer">
                      {t("issue.nftMetadata")}
                    </summary>
                    <div className="px-3 pb-3 space-y-3">
                      <Input
                        label={t("issue.nftImage")}
                        value={nftImage}
                        onChange={(e) => setNftImage(e.target.value)}
                        placeholder="https://..."
                      />
                      <Input
                        label={t("issue.nftAnimationUrl")}
                        value={nftAnimationUrl}
                        onChange={(e) => setNftAnimationUrl(e.target.value)}
                        placeholder="https://..."
                      />
                      <Input
                        label={t("issue.nftExternalUrl")}
                        value={nftExternalUrl}
                        onChange={(e) => setNftExternalUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </details>
                )}

                {/* Decimals - hidden for NFT */}
                {tokenType !== "nft" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {t("issue.decimals")}
                    </label>
                    <select
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500">
                      {[...Array(19)].map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={handleClose}>
                  {t("common.cancel")}
                </Button>
                <Button fullWidth onClick={handleConfirm}>
                  {t("common.continue")}
                </Button>
              </div>
            </>
          )}

          {/* Confirm Step */}
          {step === "confirm" && (
            <>
              <div className="space-y-3 mb-6 max-h-80 overflow-y-auto">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t("issue.tokenType")}</p>
                  <p className="text-sm font-medium text-slate-800">
                    {t(`issue.types.${tokenType}.name`)}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t("issue.name")}</p>
                  <p className="text-sm font-medium text-slate-800">{name}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t("issue.symbol")}</p>
                  <p className="text-sm font-medium text-slate-800">{symbol.toUpperCase()}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">{t("issue.amount")}</p>
                  <p className="text-sm font-medium text-slate-800">
                    {tokenType === "nft" ? "1" : parseInt(amount, 10).toLocaleString()} {symbol.toUpperCase()}
                  </p>
                </div>
                {tokenType !== "nft" && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">{t("issue.decimals")}</p>
                    <p className="text-sm font-medium text-slate-800">{decimals}</p>
                  </div>
                )}
                {description.trim() && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">{t("issue.description")}</p>
                    <p className="text-sm font-medium text-slate-800">{description}</p>
                  </div>
                )}
                {icon.trim() && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">{t("issue.icon")}</p>
                    <p className="text-sm font-medium text-slate-800 break-all">{icon}</p>
                  </div>
                )}
                {website.trim() && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">{t("issue.website")}</p>
                    <p className="text-sm font-medium text-slate-800 break-all">{website}</p>
                  </div>
                )}
                {(issuerName.trim() || issuerUrl.trim() || issuerEmail.trim()) && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">{t("issue.issuerInfo")}</p>
                    {issuerName.trim() && (
                      <p className="text-sm text-slate-800">{t("issue.issuerName")}: {issuerName}</p>
                    )}
                    {issuerUrl.trim() && (
                      <p className="text-sm text-slate-800 break-all">{t("issue.issuerUrl")}: {issuerUrl}</p>
                    )}
                    {issuerEmail.trim() && (
                      <p className="text-sm text-slate-800">{t("issue.issuerEmail")}: {issuerEmail}</p>
                    )}
                  </div>
                )}
                {tokenType === "nft" && (nftImage.trim() || nftAnimationUrl.trim() || nftExternalUrl.trim()) && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">{t("issue.nftMetadata")}</p>
                    {nftImage.trim() && (
                      <p className="text-sm text-slate-800 break-all">{t("issue.nftImage")}: {nftImage}</p>
                    )}
                    {nftAnimationUrl.trim() && (
                      <p className="text-sm text-slate-800 break-all">{t("issue.nftAnimationUrl")}: {nftAnimationUrl}</p>
                    )}
                    {nftExternalUrl.trim() && (
                      <p className="text-sm text-slate-800 break-all">{t("issue.nftExternalUrl")}: {nftExternalUrl}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setStep("input")}>
                  {t("common.back")}
                </Button>
                <Button fullWidth onClick={handleIssue}>
                  {t("issue.issue")}
                </Button>
              </div>
            </>
          )}

          {/* Issuing Step */}
          {step === "issuing" && (
            <div className="text-center py-8">
              <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-slate-600">{t("issue.issuing")}</p>
            </div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <>
              <div className="text-center py-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-slate-800">{t("issue.success")}</p>
              </div>

              {/* Registry Prompt */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-800">{t("issue.registryPrompt")}</p>
              </div>

              {/* Required Info for Registry */}
              <div className="mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">{t("issue.registryRequired")}</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500">Network</p>
                    <p className="text-sm font-medium text-slate-800">{t(network.labelKey)}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Color ID</p>
                      <button
                        onClick={() => handleCopy(resultColorId, "colorId")}
                        className="text-primary-600 hover:text-primary-700 text-xs">
                        {copiedField === "colorId" ? t("common.copied") : t("common.copy")}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-800 break-all mt-1">{resultColorId}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Payment Base</p>
                      <button
                        onClick={() => handleCopy(resultPaymentBase, "paymentBase")}
                        className="text-primary-600 hover:text-primary-700 text-xs">
                        {copiedField === "paymentBase" ? t("common.copied") : t("common.copy")}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-800 break-all mt-1">{resultPaymentBase}</p>
                  </div>
                  {resultOutPoint && (
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">OutPoint</p>
                        <button
                          onClick={() => handleCopy(resultOutPoint, "outPoint")}
                          className="text-primary-600 hover:text-primary-700 text-xs">
                          {copiedField === "outPoint" ? t("common.copied") : t("common.copy")}
                        </button>
                      </div>
                      <p className="text-xs font-mono text-slate-800 break-all mt-1">{resultOutPoint}</p>
                    </div>
                  )}
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Metadata JSON</p>
                      <button
                        onClick={() => handleCopy(getMetadataJson(), "json")}
                        className="text-primary-600 hover:text-primary-700 text-xs">
                        {copiedField === "json" ? t("common.copied") : t("issue.copyJson")}
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap break-all mt-1 max-h-24 overflow-y-auto">
                      {getMetadataJson()}
                    </pre>
                  </div>
                </div>
              </div>

              <a
                href={TOKEN_REGISTRY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full mb-3">
                <Button variant="outline" fullWidth>
                  {t("issue.openRegistry")}
                </Button>
              </a>

              <Button fullWidth onClick={handleClose}>
                {t("common.done")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
