import { buildWalletData } from "~/extension/wallet/buildWalletData"

import { NETWORKS } from "~/extension/constants/network"

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

describe("buildWalletData", () => {
  it("records the testnet address as the legacy mainnet address for a restored wallet", async () => {
    const wallet = await buildWalletData(TEST_MNEMONIC, { restored: true })

    // The pre-split derivation equals today's testnet derivation, so a
    // restored pre-split wallet's old mainnet funds sit at this address.
    expect(wallet.legacyMainnetAddress).toBe(wallet.networks[NETWORKS.testnet.id].address)
  })

  it("records no legacy mainnet address for a newly created wallet", async () => {
    const wallet = await buildWalletData(TEST_MNEMONIC, { restored: false })

    expect(wallet).not.toHaveProperty("legacyMainnetAddress")
  })

  it("derives distinct prod-format addresses for both networks", async () => {
    const wallet = await buildWalletData(TEST_MNEMONIC, { restored: false })

    const mainnet = wallet.networks[NETWORKS.mainnet.id]
    const testnet = wallet.networks[NETWORKS.testnet.id]
    expect(mainnet.address[0]).toBe("1")
    expect(testnet.address[0]).toBe("1")
    expect(mainnet.address).not.toBe(testnet.address)
    expect(wallet.mnemonic).toBe(TEST_MNEMONIC)
    expect(wallet).not.toHaveProperty("address")
    expect(wallet).not.toHaveProperty("publicKey")
  })
})
