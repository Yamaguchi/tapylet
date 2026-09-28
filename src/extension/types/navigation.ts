// UI navigation types — specific to the extension's screen flow.

export type AppScreen =
  | "loading"
  | "welcome"
  | "create"
  | "mnemonic-display"
  | "mnemonic-confirm"
  | "password-setup"
  | "restore"
  | "unlock"
  // Only reached when a legal document has been revised.
  | "consent"
  // Only reached once, right after a pre-network-split wallet gets separate
  // mainnet/testnet keys.
  | "legacy-migration-notice"
  | "main"
  | "settings"
  | "legacy-address"

export interface NavigationState {
  screen: AppScreen
  tempMnemonic: string | null
}
