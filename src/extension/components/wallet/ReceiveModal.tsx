import React from "react"
import { useTranslation } from "react-i18next"
import { QRCodeSVG } from "qrcode.react"
import { buildAddressUri } from "@tapylet/core/utils/uri"
import { useNetwork } from "~/extension/hooks/useNetwork"
import { AddressDisplay } from "./AddressDisplay"
import { Button } from "../ui"

interface ReceiveModalProps {
  address: string
  isOpen: boolean
  onClose: () => void
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({ address, isOpen, onClose }) => {
  const { t } = useTranslation()
  const { network } = useNetwork()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-sm mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-800">{t("receive.title")}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            {/* QR carries a TIP-0021 URI so scanners can tell which network
                the address belongs to; the address below stays raw so it
                remains copy-pastable. */}
            <QRCodeSVG
              value={buildAddressUri(address, network.id)}
              size={180}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Address */}
        <div className="mb-6">
          <p className="text-sm text-slate-500 mb-2">{t("receive.yourAddress")}</p>
          <AddressDisplay address={address} showFull={true} />
        </div>

        {/* Close Button */}
        <Button variant="outline" fullWidth onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </div>
  )
}
