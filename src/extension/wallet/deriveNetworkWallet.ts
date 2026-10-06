import { createHDWallet, generateAddress } from "@tapylet/core/wallet"
import type { NetworkWalletKeys } from "@tapylet/core/types/wallet"

// Derives the address/publicKey pair a WalletData.networks entry holds for
// one network. Zeroes the private key once the public key has been read from
// it, same as the wallet-creation flow that used to do this inline.
export const deriveNetworkWallet = async (
  mnemonic: string,
  networkId: number,
): Promise<NetworkWalletKeys> => {
  const keys = await createHDWallet(mnemonic, networkId)
  const address = generateAddress(keys.publicKey)
  const publicKey = Buffer.from(keys.publicKey).toString("hex")
  keys.privateKey.fill(0)
  return { address, publicKey }
}
