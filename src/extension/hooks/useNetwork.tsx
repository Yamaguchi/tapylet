// Holds the selected Tapyrus network for the UI, and is the only place that
// changes it: switching writes the choice to storage, re-points @tapylet/core
// (see ~/extension/constants/network) and then re-renders, so no screen can end
// up drawing one network's colours while core talks to another.
//
// A context rather than props because the network reaches screens, header
// chrome and the receive/issue modals, several levels down.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  applyNetwork,
  DEFAULT_NETWORK,
  getNetwork,
  type NetworkConfig,
  type NetworkKey,
} from "~/extension/constants/network"
import { networkStore, runStorageMigrations } from "~/extension/storage"

interface NetworkContextValue {
  network: NetworkConfig
  /** False until the persisted choice has been read. */
  isReady: boolean
  switchNetwork: (key: NetworkKey) => Promise<void>
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [network, setNetwork] = useState<NetworkConfig>(getNetwork)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      try {
        // Awaited before isReady, so no screen is shown while stored data is
        // still laid out the old way, and so the choice read below includes
        // the one the migration seeds for a pre-switch install.
        await runStorageMigrations()
      } catch (err) {
        console.error("Failed to migrate stored data:", err)
      }

      let selected = DEFAULT_NETWORK
      try {
        selected = await networkStore.getNetwork()
      } catch (err) {
        console.error("Failed to read the selected network:", err)
      }
      if (cancelled) return

      try {
        setNetwork(applyNetwork(selected))
      } catch (err) {
        // configureNetwork rejects a malformed endpoint — a mistyped
        // PLASMO_PUBLIC_EXPLORER_* in a dev build reaches core only once the
        // network it belongs to is selected. Core keeps the default applied at
        // module load, which is what the UI already shows.
        console.error("Failed to apply the selected network:", err)
      }
      // Set even when the steps above failed. The panel shows "Loading..."
      // until this turns true, and it holds no screen to recover from.
      setIsReady(true)
    }

    start()
    return () => {
      cancelled = true
    }
  }, [])

  // Every window has its own side panel document, each with its own copy of
  // the network in ~/extension/constants/network. Following the stored choice
  // keeps a panel from running on a network the user has already left.
  useEffect(
    () =>
      networkStore.watchNetwork((key) => {
        try {
          setNetwork(applyNetwork(key))
        } catch (err) {
          console.error("Failed to apply the selected network:", err)
        }
      }),
    [],
  )

  const switchNetwork = useCallback(async (key: NetworkKey) => {
    // Point core at the new network first: a failed write would otherwise
    // leave the UI showing a network the extension is not actually talking to.
    setNetwork(applyNetwork(key))
    await networkStore.setNetwork(key)
  }, [])

  const value = useMemo(
    () => ({ network, isReady, switchNetwork }),
    [network, isReady, switchNetwork],
  )

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  )
}

export const useNetwork = (): NetworkContextValue => {
  const value = useContext(NetworkContext)
  if (!value) {
    throw new Error("useNetwork must be used within a NetworkProvider")
  }
  return value
}
