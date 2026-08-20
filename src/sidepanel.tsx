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
import { walletStorage } from "~/extension/storage"
import { settingsStore, DEFAULT_AUTO_LOCK_MINUTES } from "~/extension/storage"
import { useAutoLock } from "~/extension/hooks/useAutoLock"
import { NetworkProvider, useNetwork } from "~/extension/hooks/useNetwork"
import { WelcomeScreen, CreateWalletScreen, MnemonicDisplayScreen, MnemonicConfirmScreen, PasswordSetupScreen, RestoreWalletScreen, UnlockScreen, MainWalletScreen, SettingsScreen } from "~/extension/screens"
import type { AppScreen } from "~/extension/types/navigation"
import "~/extension/i18n"
import "./styles/globals.css"

const UNLOCKED_SCREENS: AppScreen[] = ["main", "settings"]

function SidePanelContent() {
  // The persisted network is read asynchronously; until it arrives the panel
  // still holds the default, so no screen that can reach the chain is shown.
  const { network, isReady: isNetworkReady } = useNetwork()
  const [screen, setScreen] = useState<AppScreen>("loading")
  const [tempMnemonic, setTempMnemonic] = useState<string | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(DEFAULT_AUTO_LOCK_MINUTES)

  useEffect(() => {
    const init = async () => {
      try {
        const exists = await walletStorage.walletExists()
        setScreen(exists ? "unlock" : "welcome")
      } catch (err) {
        console.error("Failed to initialize:", err)
        setScreen("welcome")
      }
    }
    init()
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
  const handleWalletCreated = (walletAddress: string) => { setAddress(walletAddress); setTempMnemonic(null) }
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
      // Keyed on the network so a switch remounts the screen: every balance,
      // asset and pending transaction it holds belongs to the previous chain,
      // and remounting discards them all rather than clearing each.
      case "main": return address ? <MainWalletScreen key={network.id} address={address} onNavigate={handleNavigate} /> : null
      case "settings": return <SettingsScreen onNavigate={handleNavigate} />
      default: return <WelcomeScreen onNavigate={handleNavigate} />
    }
  }

  return <div className="h-full min-h-screen">{renderScreen()}</div>
}

function SidePanel() {
  return (
    <NetworkProvider>
      <SidePanelContent />
    </NetworkProvider>
  )
}

export default SidePanel
