import "@nomiclabs/hardhat-ethers";
import '@openzeppelin/hardhat-upgrades';
import { ethers } from "hardhat"
import chai from "chai"
import { solidity } from "ethereum-waffle"
chai.use(solidity)
const { expect } = chai

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { ContractFactory } from "@ethersproject/contracts"

// Rune.farm contracts
import { RuneToken } from "../typechain/RuneToken"
import { RuneShards } from "../typechain/RuneShards"

// Other contracts
import { BigNumber, ContractReceipt } from "ethers";
import { describe } from "mocha";

let runeTokenFactory: ContractFactory
let runeToken: RuneToken

let runeShardsFactory: ContractFactory
let runeShards: RuneShards

let alice: SignerWithAddress
let bob: SignerWithAddress
let carol: SignerWithAddress
let dev: SignerWithAddress
let vault: SignerWithAddress
let charity: SignerWithAddress
let main: SignerWithAddress
let bot: SignerWithAddress
let receiver: SignerWithAddress
let deployer: SignerWithAddress

const zeroAddress = ethers.constants.AddressZero
const deadAddress = ethers.utils.getAddress("0x000000000000000000000000000000000000dEaD")

const runeMaxSupply = BigNumber.from("22529999999999999996441")
const runeBurnt = BigNumber.from("3230068711317360357046")
const runeTotalSupply = runeMaxSupply.sub(runeBurnt)
const runeShardsTotalSupply = runeTotalSupply.mul("10000")

const accessControlErrorString = async (signer: SignerWithAddress, roleAccessor: () => Promise<string>): Promise<string> =>
    `AccessControl: account ${signer.address.toLowerCase()} is missing role ${await roleAccessor()}`

describe("Rune Shards", async () => {
    const excluded: string[] = []
    const bots: string[] = []

    before(async () => {
        [main, dev, vault, charity, bot, receiver, deployer, alice, bob, carol] = await ethers.getSigners()

        {
            runeTokenFactory = await ethers.getContractFactory("RuneToken", deployer)

            runeToken = (await runeTokenFactory.deploy(
            )) as RuneToken
            await runeToken.deployed()

            await runeToken.connect(deployer)["mint(address,uint256)"](alice.address, runeMaxSupply)
            expect(await runeToken.balanceOf(alice.address)).to.equal(runeMaxSupply)

            await runeToken.connect(alice).transfer(deadAddress, runeBurnt)
            expect(await runeToken.balanceOf(deadAddress)).to.equal(runeBurnt)
            expect(await runeToken.balanceOf(alice.address)).to.equal(runeTotalSupply)

            await runeToken.connect(deployer).disableMintingForever()
            await expect(
                runeToken.connect(deployer)["mint(address,uint256)"](alice.address, "1")
            ).to.be.revertedWith('Minting has been forever disabled')
            expect(await runeToken.balanceOf(alice.address)).to.equal(runeTotalSupply)
            expect(runeTotalSupply).to.equal(BigNumber.from("19299931288682639639395"))
        }

        {
            runeShardsFactory = await ethers.getContractFactory("RuneShards", deployer)

            runeShards = (await runeShardsFactory.deploy(
                zeroAddress // mintTo
            )) as RuneShards
            await runeShards.deployed()

            excluded.push(runeShards.address)

            await runeShards.connect(deployer).grantRole(await runeShards.DEV_ROLE(), dev.address)

            expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)
            expect(runeShardsTotalSupply).to.equal(BigNumber.from("192999312886826396393950000"))

            expect(await runeShards.getPastTotalSupply(6)).to.equal(BigNumber.from("192999312886826396393950000"))
        }
    })

    const expectBots = async () => {
        expect(await runeShards.botLength()).to.equal(bots.length)

        expect(await runeShards.botAll()).to.eql(bots)

        for (let i = 0; i < bots.length; ++i) {
            expect(await runeShards.botAt(i)).to.equal(bots[i])
        }

        for (let i = 0; i < bots.length; ++i) {
            expect(await runeShards.isBot(bots[i])).to.equal(true)
        }
        expect(await runeShards.isBot(deadAddress)).to.equal(false)
    }

    const expectExcluded = async () => {
        expect(await runeShards.excludedLength()).to.equal(excluded.length)

        expect(await runeShards.excludedAll()).to.eql(excluded)

        for (let i = 0; i < excluded.length; ++i) {
            expect(await runeShards.excludedAt(i)).to.equal(excluded[i])
        }

        for (let i = 0; i < excluded.length; ++i) {
            expect(await runeShards.isExcluded(excluded[i])).to.equal(true)
        }
        expect(await runeShards.isExcluded(deadAddress)).to.equal(false)
    }

    context("Basic properties", async () => {
        it("should have the correct name", async () => {
            expect(await runeShards.name()).to.equal("Rune Shards")
        })

        it("should have the correct symbol", async () => {
            expect(await runeShards.symbol()).to.equal("RXS")
        })

        it("should have the decimals", async () => {
            expect(await runeShards.decimals()).to.equal(18)
        })
    })

    context("Initial state", async () => {
        it("should have the correct default bots", async () => {
            await expectBots()
        })

        it("should have the correct default excluded", async () => {
            await expectExcluded()
        })

        it("should have the correct basis", async () => {
            expect(await runeShards.BASIS()).to.equal("10000")
        })

        it("should have the correct vaultFeeBasis", async () => {
            expect(await runeShards.vaultFeeBasis()).to.equal("80")
        })

        it("should have the correct charityFeeBasis", async () => {
            expect(await runeShards.charityFeeBasis()).to.equal("10")
        })

        it("should have the correct devFeeBasis", async () => {
            expect(await runeShards.devFeeBasis()).to.equal("10")
        })

        it("should have the correct botFeeBasis", async () => {
            expect(await runeShards.botFeeBasis()).to.equal("10000")
        })

        it("should have the correct vaultAddress", async () => {
            expect(await runeShards.vaultAddress()).to.equal("0x602a27bBf954b6945534a84C8c88FB8cA9E92B7F")
        })

        it("should have the correct charityAddress", async () => {
            expect(await runeShards.charityAddress()).to.equal("0xA40b29b0DACb37331456c2ca3b65E56a6D79FC9E")
        })

        it("should have the correct devAddress", async () => {
            expect(await runeShards.devAddress()).to.equal("0xEc9e6FBb58b3633B132dA9afB94A43446845edC8")
        })

        it("should have the correct botAddress", async () => {
            expect(await runeShards.botAddress()).to.equal("0x602a27bBf954b6945534a84C8c88FB8cA9E92B7F")
        })
    })

    context("Privileged functions", async () => {
        it("shouldn't allow non-DEV_ROLE to call add bot", async () => {
            await expectBots()

            await expect(
                runeShards.connect(alice).addBot(deadAddress)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))

            await expectBots()
        })

        it("shouldn't allow non-DEV_ROLE to call add excluded", async () => {
            await expectExcluded()

            await expect(
                runeShards.connect(alice).addExcluded(deadAddress)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))

            await expectExcluded()
        })

        it("shouldn't allow non-DEV_ROLE to call remove bot", async () => {
            await expectBots()

            await expect(
                runeShards.connect(alice).removeBot(deadAddress)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))

            await expectBots()
        })

        it("shouldn't allow non-DEV_ROLE to call remove excluded", async () => {
            await expectExcluded()

            await expect(
                runeShards.connect(alice).removeExcluded(deadAddress)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))

            await expectExcluded()
        })

        it("shouldn't allow non-DEV_ROLE to call rescue tokens", async () => {
            await expect(
                runeShards.connect(alice).rescueTokens(deadAddress)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))
        })

        it("shouldn't allow non-DEV_ROLE to call set fee info", async () => {
            await expect(
                runeShards.connect(alice).setFeeInfo(deadAddress, deadAddress, deadAddress, deadAddress, 0, 0, 0, 0)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))
        })

        it("shouldn't allow non-DEV_ROLE to call set rune", async () => {
            await expect(
                runeShards.connect(alice).setRune(deadAddress)
            ).to.be.revertedWith(await accessControlErrorString(alice, runeShards.DEV_ROLE))
        })

        it("should allow DEV_ROLE to call add bot", async () => {
            await expectBots()

            await runeShards.connect(dev).addBot(bob.address)
            bots.push(bob.address)

            await expectBots()
        })

        it("should allow DEV_ROLE to call add excluded", async () => {
            await expectExcluded()

            await runeShards.connect(dev).addExcluded(bob.address)
            excluded.push(bob.address)

            await expectExcluded()
        })

        it("should allow DEV_ROLE to call remove bot", async () => {
            await expectBots()

            await runeShards.connect(dev).removeBot(bob.address)
            bots.pop()

            await expectBots()
        })

        it("should allow DEV_ROLE to call remove excluded", async () => {
            await expectExcluded()

            await runeShards.connect(dev).removeExcluded(bob.address)
            excluded.pop()

            await expectExcluded()
        })

        it("should allow DEV_ROLE to call rescue tokens", async () => {
            await runeShards.connect(dev).rescueTokens(runeToken.address)
        })

        it("should allow DEV_ROLE to call set fee info", async () => {
            runeShards.connect(dev).setFeeInfo(deadAddress, deadAddress, deadAddress, deadAddress, 0, 0, 0, 0)
        })

        it("should allow DEV_ROLE to call set rune", async () => {
            await runeShards.connect(dev).setRune(runeToken.address)
        })
    })

    context("Partial swap", async () => {
        it("should swap correctly", async () => {
            expect(await runeToken.balanceOf(alice.address)).to.equal(runeTotalSupply)

            const swapAmount = ethers.utils.parseEther("200")
            const shardAmount = swapAmount.mul("10000")

            await runeToken.connect(alice).approve(runeShards.address, swapAmount)

            expect(
                await runeShards.connect(alice).swap(swapAmount)
            ).to.emit(runeShards, "Swap").withArgs(alice.address, shardAmount)
            expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)
            
            expect(await runeToken.balanceOf(deadAddress)).to.equal(runeBurnt.add(swapAmount))
            expect(await runeToken.balanceOf(alice.address)).to.equal(runeTotalSupply.sub(swapAmount))

            expect(await runeShards.balanceOf(alice.address)).to.equal(shardAmount)
            expect(await runeShards.balanceOf(runeShards.address)).to.equal(runeShardsTotalSupply.sub(shardAmount))
        })

        it("should swap even the smallest amount", async () => {
            const swapAmount = BigNumber.from("1")
            const shardAmount = swapAmount.mul("10000")

            await runeToken.connect(alice).approve(runeShards.address, swapAmount)

            expect(
                await runeShards.connect(alice).swap(swapAmount)
            ).to.emit(runeShards, "Swap").withArgs(alice.address, shardAmount)
            expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)
            
            expect(await runeToken.balanceOf(deadAddress)).to.equal(runeBurnt.add(ethers.utils.parseEther("200")).add(swapAmount))
            expect(await runeToken.balanceOf(alice.address)).to.equal(runeTotalSupply.sub(ethers.utils.parseEther("200")).sub(swapAmount))

            expect(await runeShards.balanceOf(alice.address)).to.equal(ethers.utils.parseEther("200").mul("10000").add(shardAmount))
            expect(await runeShards.balanceOf(runeShards.address)).to.equal(runeShardsTotalSupply.sub(ethers.utils.parseEther("200").mul("10000")).sub(shardAmount))
        })
    })

    context("Fee addresses and constraints", async () => {
        it("shouldn't allow zero vault address", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    zeroAddress,
                    charity.address,
                    dev.address,
                    bot.address,
                    0,
                    0,
                    0,
                    0)
            ).to.be.revertedWith("Cannot use zero address for fees")
        })

        it("shouldn't allow zero charity address", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    zeroAddress,
                    dev.address,
                    bot.address,
                    0,
                    0,
                    0,
                    0)
            ).to.be.revertedWith("Cannot use zero address for fees")
        })

        it("shouldn't allow zero dev address", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    charity.address,
                    zeroAddress,
                    bot.address,
                    0,
                    0,
                    0,
                    0)
            ).to.be.revertedWith("Cannot use zero address for fees")
        })

        it("shouldn't allow zero bot address", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    charity.address,
                    dev.address,
                    zeroAddress,
                    0,
                    0,
                    0,
                    0)
            ).to.be.revertedWith("Cannot use zero address for fees")
        })

        it("shouldn't allow vault fee > 1000", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    charity.address,
                    dev.address,
                    bot.address,
                    1001,
                    0,
                    0,
                    0)
            ).to.be.revertedWith("Fee constraints")
        })

        it("shouldn't allow charity fee > 50", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    charity.address,
                    dev.address,
                    bot.address,
                    0,
                    51,
                    0,
                    0)
            ).to.be.revertedWith("Fee constraints")
        })

        it("shouldn't allow dev fee > 50", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    charity.address,
                    dev.address,
                    bot.address,
                    0,
                    0,
                    51,
                    0)
            ).to.be.revertedWith("Fee constraints")
        })

        it("shouldn't allow bot fee > 10000", async () => {
            await expect(
                runeShards.connect(dev).setFeeInfo(
                    vault.address,
                    charity.address,
                    dev.address,
                    bot.address,
                    0,
                    0,
                    0,
                    10001)
            ).to.be.revertedWith("Fee constraints")
        })
    })

    context("Transfer fees", async () => {
        it("should set fee info to non-default vaules", async () => {
            await runeShards.connect(dev).setFeeInfo(
                deadAddress,
                deadAddress,
                deadAddress,
                deadAddress,
                0,
                0,
                0,
                0)

            expect(await runeShards.vaultFeeBasis()).to.equal("0")
            expect(await runeShards.charityFeeBasis()).to.equal("0")
            expect(await runeShards.devFeeBasis()).to.equal("0")
            expect(await runeShards.botFeeBasis()).to.equal("0")
            expect(await runeShards.vaultAddress()).to.equal(deadAddress)
            expect(await runeShards.charityAddress()).to.equal(deadAddress)
            expect(await runeShards.devAddress()).to.equal(deadAddress)
            expect(await runeShards.botAddress()).to.equal(deadAddress)
        })

        it("should reset fee info", async () => {
            await runeShards.connect(dev).setFeeInfo(
                vault.address,
                charity.address,
                dev.address,
                bot.address,
                80,
                10,
                10,
                10000)
        })

        it("should have the correct vaultFeeBasis", async () => {
            expect(await runeShards.vaultFeeBasis()).to.equal("80")
        })

        it("should have the correct charityFeeBasis", async () => {
            expect(await runeShards.charityFeeBasis()).to.equal("10")
        })

        it("should have the correct devFeeBasis", async () => {
            expect(await runeShards.devFeeBasis()).to.equal("10")
        })

        it("should have the correct botFeeBasis", async () => {
            expect(await runeShards.botFeeBasis()).to.equal("10000")
        })

        it("should have the correct vaultAddress", async () => {
            expect(await runeShards.vaultAddress()).to.equal(vault.address)
        })

        it("should have the correct charityAddress", async () => {
            expect(await runeShards.charityAddress()).to.equal(charity.address)
        })

        it("should have the correct devAddress", async () => {
            expect(await runeShards.devAddress()).to.equal(dev.address)
        })

        it("should have the correct botAddress", async () => {
            expect(await runeShards.botAddress()).to.equal(bot.address)
        })

        context("Standard fees", async () => {
            it("should apply transfer fees correctly", async () => {
                await expectExcluded()
                await expectBots()
                expect(await runeShards.isExcluded(alice.address)).to.equal(false)
                expect(await runeShards.isBot(alice.address)).to.equal(false)
                expect(await runeShards.isExcluded(bob.address)).to.equal(false)
                expect(await runeShards.isBot(bob.address)).to.equal(false)

                const aliceStartingBalance = await runeShards.balanceOf(alice.address)
                const bobStartingBalance = await runeShards.balanceOf(bob.address)

                const vaultStartingBalance = await runeShards.balanceOf(vault.address)
                const charityStartingBalance = await runeShards.balanceOf(charity.address)
                const devStartingBalance = await runeShards.balanceOf(dev.address)
                const botStartingBalance = await runeShards.balanceOf(bot.address)

                const transferAmount = BigNumber.from("10000")

                const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
                const vaultFee = transferAmount.mul(await runeShards.vaultFeeBasis()).div(await runeShards.BASIS())
                const vaultNewBalance = vaultStartingBalance.add(vaultFee)
                const charityFee = transferAmount.mul(await runeShards.charityFeeBasis()).div(await runeShards.BASIS())
                const charityNewBalance = charityStartingBalance.add(charityFee)
                const devFee = transferAmount.mul(await runeShards.devFeeBasis()).div(await runeShards.BASIS())
                const devNewBalance = devStartingBalance.add(devFee)
                const botFee = BigNumber.from("0")
                const botNewBalance = botStartingBalance.add(botFee)
                const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
                const bobNewBalance = bobStartingBalance.add(bobDelta)

                await runeShards.connect(alice).transfer(bob.address, transferAmount)

                expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance)
                expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
                expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
                expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
                expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
                expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance)
                expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)

                // Manual calc
                expect(vaultFee).to.equal(0.8 / 100 * 10000).to.equal(80)
                expect(charityFee).to.equal(0.1 / 100 * 10000).to.equal(10)
                expect(devFee).to.equal(0.1 / 100 * 10000).to.equal(10)
                expect(botFee).to.equal(0.0 / 100 * 10000).to.equal(0)
                expect(bobDelta).to.equal(99 / 100 * 10000).to.equal(9900)
            })
        })

        context("When sender is excluded", async () => {
            it("should exclude sender", async () => {
                await expectExcluded()
                await expectBots()
                await runeShards.connect(dev).addExcluded(alice.address)
                excluded.push(alice.address)
                await expectExcluded()
                await expectBots()
            })

            it("should apply transfer fees correctly", async () => {
                await expectExcluded()
                await expectBots()
                expect(await runeShards.isExcluded(alice.address)).to.equal(true)
                expect(await runeShards.isBot(alice.address)).to.equal(false)
                expect(await runeShards.isExcluded(bob.address)).to.equal(false)
                expect(await runeShards.isBot(bob.address)).to.equal(false)

                const aliceStartingBalance = await runeShards.balanceOf(alice.address)
                const bobStartingBalance = await runeShards.balanceOf(bob.address)

                const vaultStartingBalance = await runeShards.balanceOf(vault.address)
                const charityStartingBalance = await runeShards.balanceOf(charity.address)
                const devStartingBalance = await runeShards.balanceOf(dev.address)
                const botStartingBalance = await runeShards.balanceOf(bot.address)

                const transferAmount = BigNumber.from("10000")

                const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
                const vaultFee = BigNumber.from("0")
                const vaultNewBalance = vaultStartingBalance.add(vaultFee)
                const charityFee = BigNumber.from("0")
                const charityNewBalance = charityStartingBalance.add(charityFee)
                const devFee = BigNumber.from("0")
                const devNewBalance = devStartingBalance.add(devFee)
                const botFee = BigNumber.from("0")
                const botNewBalance = botStartingBalance.add(botFee)
                const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
                const bobNewBalance = bobStartingBalance.add(bobDelta)

                await runeShards.connect(alice).transfer(bob.address, transferAmount)

                expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance)
                expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
                expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
                expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
                expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
                expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance)
                expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)

                // Manual calc
                expect(vaultFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(charityFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(devFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(botFee).to.equal(0.0 / 100 * 10000).to.equal(0)
                expect(bobDelta).to.equal(100 / 100 * 10000).to.equal(10000)
            })
        })

        context("When both are excluded", async () => {
            it("should exclude recipient", async () => {
                await expectExcluded()
                await expectBots()
                await runeShards.connect(dev).addExcluded(bob.address)
                excluded.push(bob.address)
                await expectExcluded()
                await expectBots()
            })

            it("should apply transfer fees correctly", async () => {
                await expectExcluded()
                await expectBots()
                expect(await runeShards.isExcluded(alice.address)).to.equal(true)
                expect(await runeShards.isBot(alice.address)).to.equal(false)
                expect(await runeShards.isExcluded(bob.address)).to.equal(true)
                expect(await runeShards.isBot(bob.address)).to.equal(false)

                const aliceStartingBalance = await runeShards.balanceOf(alice.address)
                const bobStartingBalance = await runeShards.balanceOf(bob.address)

                const vaultStartingBalance = await runeShards.balanceOf(vault.address)
                const charityStartingBalance = await runeShards.balanceOf(charity.address)
                const devStartingBalance = await runeShards.balanceOf(dev.address)
                const botStartingBalance = await runeShards.balanceOf(bot.address)

                const transferAmount = BigNumber.from("10000")

                const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
                const vaultFee = BigNumber.from("0")
                const vaultNewBalance = vaultStartingBalance.add(vaultFee)
                const charityFee = BigNumber.from("0")
                const charityNewBalance = charityStartingBalance.add(charityFee)
                const devFee = BigNumber.from("0")
                const devNewBalance = devStartingBalance.add(devFee)
                const botFee = BigNumber.from("0")
                const botNewBalance = botStartingBalance.add(botFee)
                const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
                const bobNewBalance = bobStartingBalance.add(bobDelta)

                await runeShards.connect(alice).transfer(bob.address, transferAmount)

                expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance)
                expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
                expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
                expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
                expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
                expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance)
                expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)

                // Manual calc
                expect(vaultFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(charityFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(devFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(botFee).to.equal(0.0 / 100 * 10000).to.equal(0)
                expect(bobDelta).to.equal(100 / 100 * 10000).to.equal(10000)
            })
        })

        context("When recipient is excluded", async () => {
            it("should reinclude sender", async () => {
                await expectExcluded()
                await expectBots()
                await runeShards.connect(dev).removeExcluded(alice.address)
                expect(excluded.splice(excluded.indexOf(alice.address), 1)).to.eql([alice.address])
                await expectExcluded()
                await expectBots()
            })

            it("should apply transfer fees correctly", async () => {
                await expectExcluded()
                await expectBots()
                expect(await runeShards.isExcluded(alice.address)).to.equal(false)
                expect(await runeShards.isBot(alice.address)).to.equal(false)
                expect(await runeShards.isExcluded(bob.address)).to.equal(true)
                expect(await runeShards.isBot(bob.address)).to.equal(false)

                const aliceStartingBalance = await runeShards.balanceOf(alice.address)
                const bobStartingBalance = await runeShards.balanceOf(bob.address)

                const vaultStartingBalance = await runeShards.balanceOf(vault.address)
                const charityStartingBalance = await runeShards.balanceOf(charity.address)
                const devStartingBalance = await runeShards.balanceOf(dev.address)
                const botStartingBalance = await runeShards.balanceOf(bot.address)

                const transferAmount = BigNumber.from("10000")

                const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
                const vaultFee = BigNumber.from("0")
                const vaultNewBalance = vaultStartingBalance.add(vaultFee)
                const charityFee = BigNumber.from("0")
                const charityNewBalance = charityStartingBalance.add(charityFee)
                const devFee = BigNumber.from("0")
                const devNewBalance = devStartingBalance.add(devFee)
                const botFee = BigNumber.from("0")
                const botNewBalance = botStartingBalance.add(botFee)
                const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
                const bobNewBalance = bobStartingBalance.add(bobDelta)

                await runeShards.connect(alice).transfer(bob.address, transferAmount)

                expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance)
                expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
                expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
                expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
                expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
                expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance)
                expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)

                // Manual calc
                expect(vaultFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(charityFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(devFee).to.equal(0 / 100 * 10000).to.equal(0)
                expect(botFee).to.equal(0.0 / 100 * 10000).to.equal(0)
                expect(bobDelta).to.equal(100 / 100 * 10000).to.equal(10000)
            })
        })

        context("When recipient is reincluded", async () => {
            it("should reinclude recipient", async () => {
                await expectExcluded()
                await expectBots()
                await runeShards.connect(dev).removeExcluded(bob.address)
                expect(excluded.splice(excluded.indexOf(bob.address), 1)).to.eql([bob.address])
                await expectExcluded()
                await expectBots()
            })

            it("should apply transfer fees correctly", async () => {
                await expectExcluded()
                await expectBots()
                expect(await runeShards.isExcluded(alice.address)).to.equal(false)
                expect(await runeShards.isBot(alice.address)).to.equal(false)
                expect(await runeShards.isExcluded(bob.address)).to.equal(false)
                expect(await runeShards.isBot(bob.address)).to.equal(false)

                const aliceStartingBalance = await runeShards.balanceOf(alice.address)
                const bobStartingBalance = await runeShards.balanceOf(bob.address)

                const vaultStartingBalance = await runeShards.balanceOf(vault.address)
                const charityStartingBalance = await runeShards.balanceOf(charity.address)
                const devStartingBalance = await runeShards.balanceOf(dev.address)
                const botStartingBalance = await runeShards.balanceOf(bot.address)

                const transferAmount = BigNumber.from("10000")

                const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
                const vaultFee = transferAmount.mul(await runeShards.vaultFeeBasis()).div(await runeShards.BASIS())
                const vaultNewBalance = vaultStartingBalance.add(vaultFee)
                const charityFee = transferAmount.mul(await runeShards.charityFeeBasis()).div(await runeShards.BASIS())
                const charityNewBalance = charityStartingBalance.add(charityFee)
                const devFee = transferAmount.mul(await runeShards.devFeeBasis()).div(await runeShards.BASIS())
                const devNewBalance = devStartingBalance.add(devFee)
                const botFee = BigNumber.from("0")
                const botNewBalance = botStartingBalance.add(botFee)
                const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
                const bobNewBalance = bobStartingBalance.add(bobDelta)

                await runeShards.connect(alice).transfer(bob.address, transferAmount)

                expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance)
                expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
                expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
                expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
                expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
                expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance)
                expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)

                // Manual calc
                expect(vaultFee).to.equal(0.8 / 100 * 10000).to.equal(80)
                expect(charityFee).to.equal(0.1 / 100 * 10000).to.equal(10)
                expect(devFee).to.equal(0.1 / 100 * 10000).to.equal(10)
                expect(botFee).to.equal(0.0 / 100 * 10000).to.equal(0)
                expect(bobDelta).to.equal(99 / 100 * 10000).to.equal(9900)
            })
        })
    })

    context("Exclusions and bots", async () => {
        it("shouldn't allow itself to be excluded", async () => {
            await expectExcluded()
            await expect(
                runeShards.connect(dev).removeExcluded(runeShards.address)
            ).to.be.revertedWith("Can't remove Rune Shards from exclusions")
            expect(await runeShards.isExcluded(runeShards.address)).to.equal(true)
            await expectExcluded()
        })

        it("shouldn't allow itself to be added to bots", async () => {
            await expectBots()
            await expect(
                runeShards.connect(dev).addBot(runeShards.address)
            ).to.be.revertedWith("Can't add Rune Shards to bots")
            expect(await runeShards.isBot(runeShards.address)).to.equal(false)
            await expectBots()
        })

        it("shouldn't add an excluded address more than once", async () => {
            expect(excluded.indexOf(alice.address)).to.equal(-1)
            await expectExcluded()
            await runeShards.connect(dev).addExcluded(alice.address)
            excluded.push(alice.address)
            await expectExcluded()
            await runeShards.connect(dev).addExcluded(alice.address)
            await runeShards.connect(dev).addExcluded(alice.address)
            await runeShards.connect(dev).addExcluded(alice.address)
            await runeShards.connect(dev).addExcluded(alice.address)
            await runeShards.connect(dev).addExcluded(alice.address)
            await expectExcluded()
            excluded.pop()
            await runeShards.connect(dev).removeExcluded(alice.address)
            await expectExcluded()
            await runeShards.connect(dev).removeExcluded(alice.address)
            await runeShards.connect(dev).removeExcluded(alice.address)
            await expectExcluded()
        })

        it("shouldn't add a bot address more than once", async () => {
            expect(bots.indexOf(alice.address)).to.equal(-1)
            await expectBots()
            await runeShards.connect(dev).addBot(alice.address)
            bots.push(alice.address)
            await expectBots()
            await runeShards.connect(dev).addBot(alice.address)
            await runeShards.connect(dev).addBot(alice.address)
            await runeShards.connect(dev).addBot(alice.address)
            await runeShards.connect(dev).addBot(alice.address)
            await runeShards.connect(dev).addBot(alice.address)
            await expectBots()
            bots.pop()
            await runeShards.connect(dev).removeBot(alice.address)
            await expectBots()
            await runeShards.connect(dev).removeBot(alice.address)
            await runeShards.connect(dev).removeBot(alice.address)
            await expectBots()
        })
    })

    context("Dust", async () => {
        it("should leave dust when transferring full balance", async () => {
            await expectExcluded()
            await expectBots()
            expect(await runeShards.isExcluded(alice.address)).to.equal(false)
            expect(await runeShards.isBot(alice.address)).to.equal(false)
            expect(await runeShards.isExcluded(bob.address)).to.equal(false)
            expect(await runeShards.isBot(bob.address)).to.equal(false)

            const aliceStartingBalance = await runeShards.balanceOf(alice.address)
            const bobStartingBalance = await runeShards.balanceOf(bob.address)

            const vaultStartingBalance = await runeShards.balanceOf(vault.address)
            const charityStartingBalance = await runeShards.balanceOf(charity.address)
            const devStartingBalance = await runeShards.balanceOf(dev.address)
            const botStartingBalance = await runeShards.balanceOf(bot.address)

            const transferAmount = await runeShards.balanceOf(alice.address)

            const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
            expect(aliceNewBalance).to.equal(0)
            const vaultFee = transferAmount.mul(await runeShards.vaultFeeBasis()).div(await runeShards.BASIS())
            const vaultNewBalance = vaultStartingBalance.add(vaultFee)
            const charityFee = transferAmount.mul(await runeShards.charityFeeBasis()).div(await runeShards.BASIS())
            const charityNewBalance = charityStartingBalance.add(charityFee)
            const devFee = transferAmount.mul(await runeShards.devFeeBasis()).div(await runeShards.BASIS())
            const devNewBalance = devStartingBalance.add(devFee)
            const botFee = BigNumber.from("0")
            const botNewBalance = botStartingBalance.add(botFee)
            const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
            const bobNewBalance = bobStartingBalance.add(bobDelta)

            await runeShards.connect(alice).transfer(bob.address, transferAmount)

            expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance.add(1))
            expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
            expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
            expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
            expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
            expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance.sub(1))
            expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)
        })

        it("should leave dust when transferring residual balance", async () => {
            await expectExcluded()
            await expectBots()
            expect(await runeShards.isExcluded(alice.address)).to.equal(false)
            expect(await runeShards.isBot(alice.address)).to.equal(false)
            expect(await runeShards.isExcluded(bob.address)).to.equal(false)
            expect(await runeShards.isBot(bob.address)).to.equal(false)

            const aliceStartingBalance = await runeShards.balanceOf(alice.address)
            
            expect(aliceStartingBalance).to.equal("1")

            const bobStartingBalance = await runeShards.balanceOf(bob.address)

            const vaultStartingBalance = await runeShards.balanceOf(vault.address)
            const charityStartingBalance = await runeShards.balanceOf(charity.address)
            const devStartingBalance = await runeShards.balanceOf(dev.address)
            const botStartingBalance = await runeShards.balanceOf(bot.address)

            const transferAmount = await runeShards.balanceOf(alice.address)

            const aliceNewBalance = aliceStartingBalance.sub(transferAmount)
            const vaultFee = transferAmount.mul(await runeShards.vaultFeeBasis()).div(await runeShards.BASIS())
            const vaultNewBalance = vaultStartingBalance.add(vaultFee)
            const charityFee = transferAmount.mul(await runeShards.charityFeeBasis()).div(await runeShards.BASIS())
            const charityNewBalance = charityStartingBalance.add(charityFee)
            const devFee = transferAmount.mul(await runeShards.devFeeBasis()).div(await runeShards.BASIS())
            const devNewBalance = devStartingBalance.add(devFee)
            const botFee = BigNumber.from("0")
            const botNewBalance = botStartingBalance.add(botFee)
            const bobDelta = transferAmount.sub(vaultFee).sub(charityFee).sub(devFee).sub(botFee)
            const bobNewBalance = bobStartingBalance.add(bobDelta)

            await runeShards.connect(alice).transfer(bob.address, transferAmount)

            expect(await runeShards.balanceOf(alice.address)).to.equal(aliceNewBalance.add(1))
            expect(await runeShards.balanceOf(vault.address)).to.equal(vaultNewBalance)
            expect(await runeShards.balanceOf(charity.address)).to.equal(charityNewBalance)
            expect(await runeShards.balanceOf(dev.address)).to.equal(devNewBalance)
            expect(await runeShards.balanceOf(bot.address)).to.equal(botNewBalance)
            expect(await runeShards.balanceOf(bob.address)).to.equal(bobNewBalance.sub(1))
            expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)
        })

        it("shouldn't leave dust when swapping last Rune", async () => {
            const swapAmount = await runeToken.balanceOf(alice.address)
            const shardAmount = swapAmount.mul("10000")

            await runeToken.connect(alice).approve(runeShards.address, swapAmount)

            expect(
                await runeShards.connect(alice).swap(swapAmount)
            ).to.emit(runeShards, "Swap").withArgs(alice.address, shardAmount)
            expect(await runeShards.totalSupply()).to.equal(runeShardsTotalSupply)
            
            expect(await runeToken.balanceOf(deadAddress)).to.equal(runeMaxSupply)
            expect(await runeToken.balanceOf(alice.address)).to.equal("0")

            expect(await runeShards.balanceOf(alice.address)).to.equal(
                runeShardsTotalSupply
                    .sub(await runeShards.balanceOf(bob.address))
                    .sub(await runeShards.balanceOf(vault.address))
                    .sub(await runeShards.balanceOf(charity.address))
                    .sub(await runeShards.balanceOf(dev.address))
            )

            expect(await runeShards.balanceOf(runeShards.address)).to.equal("0")
        })
    })
})
