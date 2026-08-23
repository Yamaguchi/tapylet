import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button, Input } from "../ui"
import { validateAddress } from "@tapylet/core/wallet"
import { createAndSignTransaction, createAndSignAssetTransaction, MAX_SPLIT } from "@tapylet/core/wallet/transaction"
import { DUST_THRESHOLD, DEFAULT_FEE_RATE, estimateTxSize } from "@tapylet/core/constants/transaction"
import { parseTpc, formatTpc, formatTokenAmount, formatColorId, getExplorerColorUrl, TPC_COLOR_ID, type AssetBalance, type BalanceDetails, type Metadata } from "@tapylet/core/api"
import { walletStorage } from "~/extension/storage"
import { isValidAmount, parseAndValidateAmount, MAX_AMOUNT, MAX_COLORED_AMOUNT } from "@tapylet/core/utils/validation"

interface SendModalProps {
  address: string
  tpcBalance: BalanceDetails
  assets: AssetBalance[]
  tokenMetadata: Map<string, Metadata>
  isOpen: boolean
  onClose: () => void
  onSuccess: (txid: string, amount: number, toAddress: string, colorId?: string) => void
}

type SendStep = "input" | "confirm" | "sending" | "success" | "error"

export const SendModal: React.FC<SendModalProps> = ({
  address,
  tpcBalance,
  assets,
  tokenMetadata,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation()
  const [step, setStep] = useState<SendStep>("input")
  const [selectedColorId, setSelectedColorId] = useState<string>(TPC_COLOR_ID)
  const [toAddress, setToAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [split, setSplit] = useState("1")
  const [error, setError] = useState<string | null>(null)
  const [txid, setTxid] = useState<string | null>(null)

  const isTpc = selectedColorId === TPC_COLOR_ID
  const selectedAsset = assets.find(a => a.colorId === selectedColorId)
  const selectedMeta = tokenMetadata.get(selectedColorId)
  const selectedDecimals = selectedMeta?.decimals
  // NFTs are indivisible, so the split field is hidden and 1 is always sent.
  const isNft = selectedMeta?.tokenType === "nft"
  const availableBalance = isTpc ? tpcBalance.total : (selectedAsset?.total ?? 0)
  const sendSplit = isNft ? 1 : Number(split)

  const resetState = () => {
    setStep("input")
    setSelectedColorId(TPC_COLOR_ID)
    setToAddress("")
    setAmount("")
    setSplit("1")
    setError(null)
    setTxid(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const handleConfirm = () => {
    setError(null)

    // Validate address
    if (!toAddress.trim()) {
      setError(t("send.errors.enterAddress"))
      return
    }

    if (!validateAddress(toAddress.trim())) {
      setError(t("send.errors.invalidAddress"))
      return
    }

    // Validate amount
    if (!amount.trim()) {
      setError(t("send.errors.enterAmount"))
      return
    }

    let parsedAmount: number
    if (isTpc) {
      try {
        parsedAmount = parseTpc(amount)
      } catch {
        setError(t("send.errors.invalidAmount"))
        return
      }
      // Validate TPC amount is within safe range
      if (!isValidAmount(parsedAmount, MAX_AMOUNT)) {
        setError(t("send.errors.invalidAmount"))
        return
      }
    } else {
      const parsed = parseAndValidateAmount(amount, MAX_COLORED_AMOUNT, selectedDecimals)
      if (parsed === null) {
        setError(t("send.errors.invalidAmount"))
        return
      }
      parsedAmount = parsed
    }

    if (parsedAmount <= 0) {
      setError(t("send.errors.amountGreaterThanZero"))
      return
    }

    // dust を下回る TPC 出力は中継されない。
    if (isTpc && parsedAmount < DUST_THRESHOLD) {
      setError(t("send.errors.amountBelowDust", { amount: formatTpc(DUST_THRESHOLD) }))
      return
    }

    if (parsedAmount > availableBalance) {
      setError(t("send.errors.insufficientBalance"))
      return
    }

    let parsedSplit = 1
    if (!isNft) {
      if (!split) {
        setError(t("send.errors.splitRequired"))
        return
      }

      parsedSplit = Number(split)
      if (!Number.isInteger(parsedSplit) || parsedSplit < 1 || parsedSplit > MAX_SPLIT) {
        setError(t("send.errors.invalidSplit", { max: MAX_SPLIT }))
        return
      }

      if (isTpc) {
        if (parsedSplit > 1 && Math.floor(parsedAmount / parsedSplit) < DUST_THRESHOLD) {
          setError(t("send.errors.splitBelowDust", { amount: formatTpc(DUST_THRESHOLD) }))
          return
        }
      } else if (parsedSplit > parsedAmount) {
        // 分割数が数量を超えると、core が数量ぶんの出力しか作らず指定と食い違う。
        setError(t("send.errors.splitExceedsAmount"))
        return
      }
    }

    // 分割で出力が増えたぶん手数料も増える。core が組みうる最小構成で見積もり、
    // 明らかに足りない指定を確認画面へ進ませない。実際の入力が増えれば手数料は
    // これより大きくなるため、見積もりが過大になって誤って弾くことはない。
    if (isTpc) {
      const minFee = Math.ceil(estimateTxSize(1, parsedSplit + 1) * DEFAULT_FEE_RATE)
      if (parsedAmount + minFee > availableBalance) {
        setError(t("send.errors.insufficientWithFee"))
        return
      }
    } else {
      const minFee = Math.ceil(estimateTxSize(2, 1, parsedSplit) * DEFAULT_FEE_RATE)
      if (minFee > tpcBalance.total) {
        setError(t("send.errors.insufficientTpcForFee"))
        return
      }
    }

    setStep("confirm")
  }

  const handleSend = async () => {
    setStep("sending")
    setError(null)

    try {
      const walletData = await walletStorage.getWallet()
      if (!walletData) {
        throw new Error("Wallet not found")
      }

      let result
      let sendAmount: number

      if (isTpc) {
        sendAmount = parseTpc(amount)
        result = await createAndSignTransaction({
          fromAddress: address,
          toAddress: toAddress.trim(),
          amount: sendAmount,
          split: sendSplit,
          mnemonic: walletData.mnemonic,
        })
      } else {
        sendAmount = parseAndValidateAmount(amount, MAX_COLORED_AMOUNT, selectedDecimals)!
        result = await createAndSignAssetTransaction({
          fromAddress: address,
          toAddress: toAddress.trim(),
          amount: sendAmount,
          split: sendSplit,
          colorId: selectedColorId,
          mnemonic: walletData.mnemonic,
        })
      }

      setTxid(result.txid)
      setStep("success")
      onSuccess(result.txid, sendAmount, toAddress.trim(), isTpc ? undefined : selectedColorId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed")
      setStep("error")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">
            {step === "success" ? t("send.sentTitle") : t("send.title")}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <svg
              className="w-5 h-5 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Input Step */}
        {step === "input" && (
          <>
            <div className="space-y-4 mb-6">
              {/* Asset Selector */}
              {assets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("send.asset")}
                  </label>
                  <select
                    value={selectedColorId}
                    onChange={(e) => {
                      setSelectedColorId(e.target.value)
                      setAmount("")
                      setSplit("1")
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                    <option value={TPC_COLOR_ID}>TPC</option>
                    {assets.map((asset) => {
                      const meta = tokenMetadata.get(asset.colorId)
                      return (
                        <option key={asset.colorId} value={asset.colorId}>
                          {meta ? `${meta.name} (${meta.symbol})` : formatColorId(asset.colorId)}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("send.recipientAddress")}
                </label>
                <Input
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder={t("send.enterAddress")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {isTpc ? t("send.amount") : t("send.assetAmount")}
                </label>
                <Input
                  type="number"
                  step={isTpc ? "0.00000001" : selectedDecimals ? String(Math.pow(10, -selectedDecimals)) : "1"}
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={isTpc ? "0.00000000" : "0"}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {isTpc
                    ? t("send.available", { amount: formatTpc(availableBalance) })
                    : t("send.availableAsset", { amount: formatTokenAmount(availableBalance, selectedDecimals) })}
                </p>
                {!isTpc && selectedDecimals ? (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("common.decimalHint", { decimals: selectedDecimals })}
                  </p>
                ) : null}
              </div>

              {!isNft && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t("send.split")}
                  </label>
                  <Input
                    value={split}
                    onChange={(e) =>
                      setSplit(e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, ""))
                    }
                    placeholder={t("send.splitPlaceholder")}
                    type="text"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {t("send.splitHint", { max: MAX_SPLIT })}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-500 mb-4">{error}</p>
            )}

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
            <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
              {!isTpc && (
                <div>
                  <p className="text-xs text-slate-500">{t("send.asset")}</p>
                  {tokenMetadata.get(selectedColorId) ? (
                    <p className="text-sm font-medium text-slate-800">
                      {tokenMetadata.get(selectedColorId)!.name}
                      <span className="text-slate-500 ml-1">({tokenMetadata.get(selectedColorId)!.symbol})</span>
                    </p>
                  ) : (
                    <a
                      href={getExplorerColorUrl(selectedColorId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-primary-600 hover:text-primary-700 underline">
                      {formatColorId(selectedColorId)}
                    </a>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs text-slate-500">{t("send.to")}</p>
                <p className="text-sm font-mono break-all">{toAddress}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{isTpc ? t("send.amount") : t("send.assetAmount")}</p>
                <p className="text-lg font-semibold">
                  {isTpc ? `${amount} TPC` : parseFloat(amount).toLocaleString()}
                </p>
              </div>
              {sendSplit > 1 && (
                <div>
                  <p className="text-xs text-slate-500">{t("send.split")}</p>
                  <p className="text-sm font-medium text-slate-800">
                    {Number(split).toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 mb-6 text-center">
              {t("send.confirmTransaction")}
            </p>

            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={() => setStep("input")}>
                {t("common.back")}
              </Button>
              <Button fullWidth onClick={handleSend}>
                {t("common.send")}
              </Button>
            </div>
          </>
        )}

        {/* Sending Step */}
        {step === "sending" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-600">{t("send.sending")}</p>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-800 mb-2">
                {t("send.transactionSent")}
              </p>
              <p className="text-sm text-slate-500 mb-4">
                {isTpc
                  ? t("send.sentSuccessfully", { amount })
                  : t("send.assetSentSuccessfully", { amount: parseFloat(amount).toLocaleString() })}
              </p>
              {txid && (
                <p className="text-xs font-mono text-slate-400 break-all px-4">
                  TX: {txid}
                </p>
              )}
            </div>

            <Button fullWidth onClick={handleClose} className="mt-6">
              {t("common.done")}
            </Button>
          </>
        )}

        {/* Error Step */}
        {step === "error" && (
          <>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-800 mb-2">
                {t("send.transactionFailed")}
              </p>
              <p className="text-sm text-red-500">{error}</p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" fullWidth onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button fullWidth onClick={() => setStep("input")}>
                {t("common.tryAgain")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
