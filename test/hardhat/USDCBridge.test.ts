import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract, Signer } from 'ethers'

describe('USDCBridgeSender', function () {
    let owner: Signer
    let nonOwner: Signer
    let mockUSDC: Contract
    let bridge: Contract
    let mockMessenger: Contract

    const destinationDomain = 6 // Base
    let destinationCaller: string
    const initialBalance = ethers.utils.parseUnits('1000', 6) // 1000 USDC

    beforeEach(async function () {
        ;[owner, nonOwner] = await ethers.getSigners()

        const MockUSDC = await ethers.getContractFactory('Usdc')
        mockUSDC = await MockUSDC.deploy('Usdc', 'USDC', await owner.getAddress(), initialBalance)

        const MockMessenger = await ethers.getContractFactory('MockTokenMessenger')
        mockMessenger = await MockMessenger.deploy()

        const USDCBridgeSender = await ethers.getContractFactory('USDCBridge')
        destinationCaller = await nonOwner.getAddress()
        bridge = await USDCBridgeSender.deploy(
            mockUSDC.address,
            mockMessenger.address,
            destinationDomain,
            destinationCaller
        )

        await mockUSDC.connect(owner).transfer(bridge.address, initialBalance)
    })

    it('only owner can bridge USDC', async function () {
        // Non-owner should fail
        try {
            await bridge.connect(nonOwner).bridgeUSDC()
            expect.fail('Expected revert for non-owner')
        } catch (err: any) {
            expect(err.message).to.include('Not authorized')
        }

        // Owner should succeed and emit BridgeInitiated event
        const tx = await bridge.connect(owner).bridgeUSDC()
        const receipt = await tx.wait()

        const event = receipt.events?.find((e: any) => e.event === 'BridgeInitiated')
        expect(event).to.not.be.undefined
        expect(event?.args?.from).to.equal(await owner.getAddress())
        expect(event?.args?.amount.toString()).to.equal(initialBalance.toString())
    })

    it('emergencyWithdraw transfers USDC and ETH to owner', async function () {
        const ethAmount = ethers.utils.parseEther('1')
        await owner.sendTransaction({ to: bridge.address, value: ethAmount })

        const ownerUSDCBefore = await mockUSDC.balanceOf(await owner.getAddress())
        const ownerETHBefore = await ethers.provider.getBalance(await owner.getAddress())

        const tx = await bridge.connect(owner).emergencyWithdraw()
        const receipt = await tx.wait()
        const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

        const ownerUSDCAfter = await mockUSDC.balanceOf(await owner.getAddress())
        const ownerETHAfter = await ethers.provider.getBalance(await owner.getAddress())

        expect(ownerUSDCAfter.sub(ownerUSDCBefore).toString()).to.equal(initialBalance.toString())
        expect(ownerETHAfter.add(gasUsed).sub(ownerETHBefore).toString()).to.equal(ethAmount.toString())
    })

    it('allows owner to change destinationCaller and ownership', async function () {
        const newDest = await owner.getAddress()

        // Non-owner should not be able to set destinationCaller
        try {
            await bridge.connect(nonOwner).setDestinationCaller(newDest)
            expect.fail('Expected revert for non-owner destinationCaller update')
        } catch (err: any) {
            expect(err.message).to.include('Not authorized')
        }

        // Owner can set destinationCaller
        const tx1 = await bridge.connect(owner).setDestinationCaller(newDest)
        const receipt1 = await tx1.wait()
        const destEvent = receipt1.events?.find((e: any) => e.event === 'DestinationCallerUpdated')
        expect(destEvent).to.not.be.undefined
        expect(destEvent?.args?.newDestinationCaller).to.equal(newDest)

        // Owner can transfer ownership
        const newOwnerAddr = await nonOwner.getAddress()
        const tx2 = await bridge.connect(owner).setOwner(newOwnerAddr)
        const receipt2 = await tx2.wait()
        const ownerEvent = receipt2.events?.find((e: any) => e.event === 'OwnerUpdated')
        expect(ownerEvent).to.not.be.undefined
        expect(ownerEvent?.args?.newOwner).to.equal(newOwnerAddr)

        // Old owner should now be unauthorized
        try {
            await bridge.connect(owner).bridgeUSDC()
            expect.fail('Expected revert for old owner')
        } catch (err: any) {
            expect(err.message).to.include('Not authorized')
        }

        // New owner can bridge
        const tx3 = await bridge.connect(nonOwner).bridgeUSDC()
        const receipt3 = await tx3.wait()
        const bridgeEvent = receipt3.events?.find((e: any) => e.event === 'BridgeInitiated')
        expect(bridgeEvent).to.not.be.undefined
        expect(bridgeEvent?.args?.from).to.equal(newOwnerAddr)
    })
})
