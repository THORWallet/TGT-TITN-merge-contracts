import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { ethers } from 'hardhat'

describe('RafflePayout', function () {
    let owner: SignerWithAddress
    let delegate: SignerWithAddress
    let newOwner: SignerWithAddress
    let winner1: SignerWithAddress
    let winner2: SignerWithAddress
    let nonWinner: SignerWithAddress

    let RafflePayout: ContractFactory
    let MockUSDC: ContractFactory
    let raffle: Contract
    let usdc: Contract

    const RAFFLE_ID = 1
    const CLAIM_DURATION = 30 * 24 * 60 * 60 // 30 days
    const usdcMinted = ethers.utils.parseUnits('1000', 6)
    const reward1 = ethers.utils.parseUnits('100', 6)
    const reward2 = ethers.utils.parseUnits('50', 6)
    const totalReward = reward1.add(reward2)

    before(async function () {
        ;[owner, delegate, newOwner, winner1, winner2, nonWinner] = await ethers.getSigners()
        RafflePayout = await ethers.getContractFactory('RafflePayout')
        MockUSDC = await ethers.getContractFactory('Usdc')
    })

    beforeEach(async function () {
        usdc = await MockUSDC.deploy('Usdc', 'USDC', owner.address, usdcMinted)
        // send USDC to the delegate
        await usdc.connect(owner).transfer(delegate.address, usdcMinted)
        raffle = await RafflePayout.deploy(usdc.address)
        await raffle.connect(owner).setDelegate(delegate.address)
    })

    it('should allow the owner to finalize a raffle and winners to claim', async function () {
        await usdc.connect(delegate).approve(raffle.address, totalReward)

        await raffle
            .connect(delegate)
            .finalizeRaffle(RAFFLE_ID, [winner1.address, winner2.address], [reward1, reward2], totalReward)

        const claimable = await raffle.getClaimable(winner1.address, RAFFLE_ID)
        expect(claimable.eq(reward1)).to.be.true

        // initial USDC balance should be 0
        const balanceBefore = await usdc.balanceOf(winner1.address)
        expect(balanceBefore.eq('0'))
        await raffle.connect(winner1).claim(RAFFLE_ID)

        // Balance after claiming should be equal to reward1
        const balanceAfter = await usdc.balanceOf(winner1.address)
        expect(balanceAfter.eq(reward1))

        // the user should not be able to claim again for the same RAFFLE_ID
        try {
            await raffle.connect(winner1).claim(RAFFLE_ID)
            expect.fail('Transaction should have reverted')
        } catch (error: any) {
            expect(error.message).to.include('Already claimed')
        }
    })

    it('should prevent non-winners from claiming', async function () {
        await usdc.connect(delegate).approve(raffle.address, totalReward)

        await raffle.connect(delegate).finalizeRaffle(RAFFLE_ID, [winner1.address], [reward1], reward1)

        try {
            await raffle.connect(nonWinner).claim(RAFFLE_ID)
            expect.fail('Transaction should have reverted')
        } catch (error: any) {
            expect(error.message).to.include('Not a winner')
        }
    })

    it('should allow owner to reclaim unclaimed funds after 30 days', async function () {
        await usdc.connect(delegate).approve(raffle.address, totalReward)

        await raffle
            .connect(delegate)
            .finalizeRaffle(RAFFLE_ID, [winner1.address, winner2.address], [reward1, reward2], totalReward)

        // Winner1 claims, winner2 does not
        await raffle.connect(winner1).claim(RAFFLE_ID)

        // Increase time by 31 days
        await ethers.provider.send('evm_increaseTime', [31 * 24 * 60 * 60])
        await ethers.provider.send('evm_mine', [])

        await raffle.recoverExpiredFunds(RAFFLE_ID, [winner1.address, winner2.address])

        const balance = await usdc.balanceOf(owner.address)
        expect(balance.toString()).eq(reward2.toString())
    })

    it('should allow owner to update owner', async function () {
        await raffle.updateOwner(newOwner.address)
        expect(await raffle.owner()).to.equal(newOwner.address)
    })

    it('should prevent claims after deadline', async function () {
        await usdc.connect(delegate).approve(raffle.address, reward1)
        await raffle.connect(delegate).finalizeRaffle(RAFFLE_ID, [winner1.address], [reward1], reward1)

        await ethers.provider.send('evm_increaseTime', [CLAIM_DURATION + 1])
        await ethers.provider.send('evm_mine', [])

        try {
            await raffle.connect(winner1).claim(RAFFLE_ID)
            expect.fail('Transaction should have reverted')
        } catch (error: any) {
            expect(error.message).to.include('Claim period expired')
        }
    })
})
