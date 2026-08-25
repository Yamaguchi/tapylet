// Injects the default network into @tapylet/core (the persisted choice
// replaces it once NetworkProvider has read it). Must stay above every import
// that reaches core: ES modules evaluate dependencies in import order, so
// anything listed earlier runs its module body first and would observe an
// unconfigured core. Today core is only touched at render time, which is well
// after this runs either way — the position is what keeps that from being
// load-bearing.
import "~/extension/constants/network"

import { useCallback, useEffect, useState } from "react"
import { Loading } from "~/extension/components/ui"
import { LegalUpdateNotice } from "~/extension/components/LegalUpdateNotice"
import { consentStore, legalManifestStore, walletStorage } from "~/extension/storage"
import { settingsStore, DEFAULT_AUTO_LOCK_MINUTES } from "~/extension/storage"
import { useAutoLock } from "~/extension/hooks/useAutoLock"
import { NetworkProvider, useNetwork } from "~/extension/hooks/useNetwork"
import { applyLegalManifest, LEGAL_DOC_IDS, majorsOf, outdatedDocs, type LegalDocId } from "~/extension/legal"
import { fetchLegalManifest } from "~/extension/legalManifest"
import { WelcomeScreen, CreateWalletScreen, MnemonicDisplayScreen, MnemonicConfirmScreen, PasswordSetupScreen, RestoreWalletScreen, UnlockScreen, ConsentUpdateScreen, MainWalletScreen, SettingsScreen } from "~/extension/screens"
import type { AppScreen } from "~/extension/types/navigation"
import "~/extension/i18n"
import "./styles/globals.css"

// The screens that carry consent checkboxes of their own.
const CONSENT_SCREENS: AppScreen[] = ["welcome", "consent"]

const UNLOCKED_SCREENS: AppScreen[] = ["main", "settings"]

function SidePanelContent() {
  // The persisted network is read asynchronously; until it arrives the panel
  // still holds the default, so no screen that can reach the chain is shown.
  const { network, isReady: isNetworkReady } = useNetwork()
  const [screen, setScreen] = useState<AppScreen>("loading")
  const [tempMnemonic, setTempMnemonic] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(DEFAULT_AUTO_LOCK_MINUTES)
  // The documents that have to be agreed to (acknowledged) again. Only consulted
  // for a wallet that already exists: the welcome screen carries its own
  // checkboxes, so anything created or restored from there is already current.
  const [outdatedConsents, setOutdatedConsents] = useState<LegalDocId[]>([])

  useEffect(() => {
    // Held back until the provider is ready, because that is what runs the
    // storage migrations. One of them puts an existing install's consent on
    // record, and reading the record first would ask those users to agree to
    // something that has not changed.
    if (!isNetworkReady) return
    const init = async () => {
      try {
        // Which version of each document is in effect, as of the last time the
        // published manifest could be read. Applied before the screen is
        // decided; today's copy is fetched below and takes effect next launch.
        applyLegalManifest(await legalManifestStore.get())
      } catch (err) {
        // The documents this build shipped with stay in effect.
        console.error("Failed to read the stored legal manifest:", err)
      }
      try {
        const exists = await walletStorage.walletExists()
        if (!exists) {
          setScreen("welcome")
          return
        }
        // A revised document has to be responded to before the wallet can be
        // unlocked. A store that cannot be read counts as no record at all, so
        // the user is asked again rather than let through unasked.
        const agreed = await consentStore.getAgreedVersions().catch(() => ({}))
        const outdated = outdatedDocs(majorsOf(agreed))
        setOutdatedConsents(outdated)
        setScreen(outdated.length > 0 ? "consent" : "unlock")
      } catch (err) {
        console.error("Failed to initialize:", err)
        setScreen("welcome")
      }
    }
    init()
  }, [isNetworkReady])

  // Refreshes the published manifest beside the screen rather than in front of
  // it. Nothing waits on the result: a revision reaching the user one launch
  // later is a fair price for a wallet that opens at the same speed offline.
  useEffect(() => {
    let cancelled = false
    fetchLegalManifest()
      .then((manifest) => {
        if (cancelled || !manifest) return
        return legalManifestStore.set(manifest)
      })
      .catch((err) =>
        console.error("Failed to store the legal manifest:", err),
      )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    settingsStore.getAutoLockMinutes().then(setAutoLockMinutes)
    const unwatch = settingsStore.watchAutoLockMinutes(setAutoLockMinutes)
    return unwatch
  }, [])

  const handleAutoLock = useCallback(() => {
    walletStorage.lock()
    setScreen("unlock")
  }, [])

  const isUnlockedScreen = UNLOCKED_SCREENS.includes(screen)
  useAutoLock(isUnlockedScreen ? autoLockMinutes * 60 * 1000 : 0, handleAutoLock)

  const handleNavigate = (newScreen: AppScreen) => setScreen(newScreen)
  const handleMnemonicGenerated = (mnemonic: string) => setTempMnemonic(mnemonic)
  const handleMnemonicEntered = (mnemonic: string) => setTempMnemonic(mnemonic)
  const recordConsent = (docs: readonly LegalDocId[]) =>
    consentStore
      .agree([...docs])
      .catch((err) => console.error("Failed to store the consent:", err))
  // The welcome screen took the consent for both documents, so the wallet and
  // the record of what was agreed to come into being together.
  const handleWalletCreated = (walletAddress: string) => { setAddress(walletAddress); setTempMnemonic(null); recordConsent(LEGAL_DOC_IDS) }
  const handleConsentAgree = async () => {
    // Only the documents the screen put to the user.
    await recordConsent(outdatedConsents)
    setOutdatedConsents([])
    setScreen("unlock")
  }
  const handleUnlock = (walletAddress: string) => setAddress(walletAddress)

  const renderScreen = () => {
    if (!isNetworkReady) {
      return <div className="flex h-full items-center justify-center"><Loading size="lg" text="Loading..." /></div>
    }
    switch (screen) {
      case "loading": return <div className="flex h-full items-center justify-center"><Loading size="lg" text="Loading..." /></div>
      case "welcome": return <WelcomeScreen onNavigate={handleNavigate} />
      case "create": return <CreateWalletScreen onNavigate={handleNavigate} onMnemonicGenerated={handleMnemonicGenerated} />
      case "mnemonic-display": return tempMnemonic ? <MnemonicDisplayScreen mnemonic={tempMnemonic} onNavigate={handleNavigate} /> : null
      case "mnemonic-confirm": return tempMnemonic ? <MnemonicConfirmScreen mnemonic={tempMnemonic} onNavigate={handleNavigate} /> : null
      case "password-setup": return tempMnemonic ? <PasswordSetupScreen mnemonic={tempMnemonic} onNavigate={handleNavigate} onWalletCreated={handleWalletCreated} /> : null
      case "restore": return <RestoreWalletScreen onNavigate={handleNavigate} onMnemonicEntered={handleMnemonicEntered} />
      case "unlock": return <UnlockScreen onNavigate={handleNavigate} onUnlock={handleUnlock} />
      case "consent": return <ConsentUpdateScreen docs={outdatedConsents} onAgree={handleConsentAgree} />
      // Keyed on the network so a switch remounts the screen: every balance,
      // asset and pending transaction it holds belongs to the previous chain,
      // and remounting discards them all rather than clearing each.
      case "main": return address ? <MainWalletScreen key={network.id} address={address} onNavigate={handleNavigate} /> : null
      case "settings": return <SettingsScreen onNavigate={handleNavigate} />
      default: return <WelcomeScreen onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* The announcement banner. Kept off the screens that are themselves
          asking the user to respond to a document: there the version being
          asked about now and the one announced for later would sit side by
          side, with nothing to say which is which. */}
      {!CONSENT_SCREENS.includes(screen) && <LegalUpdateNotice />}
      <div className="min-h-0 flex-1">{renderScreen()}</div>
    </div>
  )
}

function SidePanel() {
  return (
    <NetworkProvider>
      <SidePanelContent />
    </NetworkProvider>
  )
}

export default SidePanel
