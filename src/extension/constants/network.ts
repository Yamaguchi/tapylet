/**
 * The Tapyrus networks the extension can operate on, and the single place that
 * switches between them. @tapylet/core does not resolve a network on its own —
 * it also runs under React Native, where the build-time variables a Plasmo
 * build would read do not exist — so the host injects the whole configuration.
 *
 * The network id drives TIP-0021 URIs and token registry lookups, while the
 * explorer URLs decide which chain balances and broadcasts go to. They always
 * move together: core takes them in a single configureNetwork call, and
 * applyNetwork is the only place in the extension that makes it.
 *
 * TIP-0044 network ids: 15215628 = Tapyrus API (mainnet), 1939510133 = Tapyrus
 * Testnet.
 */
import { configureNetwork } from "@tapylet/core/config/network"

export type NetworkKey = "mainnet" | "testnet"

export interface NetworkConfig {
  key: NetworkKey
  /** TIP-0044 network id */
  id: number
  /** i18n key for the display name */
  labelKey: string
  /** Esplora REST API base */
  explorerApiUrl: string
  /** Block explorer web UI base */
  explorerWebUrl: string
  /**
   * Tailwind classes identifying the network across the UI. Written out in
   * full rather than assembled from a colour name: Tailwind generates CSS by
   * scanning the source for complete class names, and a string built at
   * runtime produces no rule at all.
   */
  headerClass: string
  dotClass: string
  activeBorderClass: string
  activeTextClass: string
}

const TESTNET_API_URL = "https://testnet-explorer.tapyrus.dev.chaintope.com/api"
const TESTNET_WEB_URL = "https://testnet-explorer.tapyrus.dev.chaintope.com"

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  mainnet: {
    key: "mainnet",
    id: 15215628,
    labelKey: "network.mainnet",
    explorerApiUrl: "https://explorer.api.tapyrus.chaintope.com/api",
    explorerWebUrl: "https://explorer.api.tapyrus.chaintope.com",
    headerClass: "bg-primary-600",
    dotClass: "bg-primary-600",
    activeBorderClass: "border-primary-600",
    activeTextClass: "text-primary-600",
  },
  testnet: {
    key: "testnet",
    id: 1939510133,
    labelKey: "network.testnet",
    // Overridable so a dev build can point testnet at a locally running
    // tapyrus-explorer (see README). Only testnet is overridable: a local
    // explorer stands in for the test chain, never for mainnet.
    explorerApiUrl: process.env.PLASMO_PUBLIC_EXPLORER_API_URL ?? TESTNET_API_URL,
    explorerWebUrl: process.env.PLASMO_PUBLIC_EXPLORER_URL ?? TESTNET_WEB_URL,
    headerClass: "bg-orange-600",
    dotClass: "bg-orange-500",
    activeBorderClass: "border-orange-500",
    activeTextClass: "text-orange-600",
  },
}

export const NETWORK_KEYS: NetworkKey[] = ["mainnet", "testnet"]

// mainnet: the network the wallet is meant to be used on. Installs that predate
// the network switch ran on testnet and have no stored choice, so they land here
// on update — their testnet data is kept (see ../storage/migrations.ts) and
// reappears once testnet is selected in the settings screen.
export const DEFAULT_NETWORK: NetworkKey = "mainnet"

// Membership in the list, not `in NETWORKS`: `in` walks the prototype chain,
// so "constructor" and "toString" would pass as networks and resolve to an
// object with no id, which configureNetwork rejects at startup.
export const isNetworkKey = (value: unknown): value is NetworkKey =>
  NETWORK_KEYS.includes(value as NetworkKey)

let current: NetworkConfig = NETWORKS[DEFAULT_NETWORK]

/**
 * Points the extension — and @tapylet/core with it — at `key`. Safe to call
 * again at any time; call sites read the network per operation rather than
 * caching it, so a switch takes effect on the next request.
 */
export const applyNetwork = (key: NetworkKey): NetworkConfig => {
  const config = NETWORKS[key]
  configureNetwork({
    networkId: config.id,
    explorer: {
      apiUrl: config.explorerApiUrl,
      webUrl: config.explorerWebUrl,
    },
  })
  current = config
  return config
}

/** The network in effect right now. */
export const getNetwork = (): NetworkConfig => current

/**
 * Applied at module load so core is configured before anything can call it.
 * The persisted choice is read asynchronously during startup (see
 * ~/extension/hooks/useNetwork) and replaces this default once it arrives.
 */
applyNetwork(DEFAULT_NETWORK)
