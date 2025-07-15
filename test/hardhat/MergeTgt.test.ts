import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

import { Options } from '@layerzerolabs/lz-v2-utilities'

const TITN_ARB_RAW = '166800000'
const TITN_ARB = ethers.utils.parseUnits(TITN_ARB_RAW, 18)
const TGT_TO_EXCHANGE = ethers.utils.parseUnits('444800000', 18)

describe('MergeTgt tests', function () {
    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1
    const eidB = 2
    // Other variables to be used in the test suite
    let Titn: ContractFactory
    let MergeTgt: ContractFactory
    let Tgt: ContractFactory
    let EndpointV2Mock: ContractFactory
    let ownerA: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress
    let baseTITN: Contract
    let arbTITN: Contract
    let mergeTgt: Contract
    let tgt: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract
    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        Titn = await ethers.getContractFactory('Titn')
        MergeTgt = await ethers.getContractFactory('MergeTgt')
        Tgt = await ethers.getContractFactory('Tgt')
        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners()
        ;[ownerA, endpointOwner, user1, user2, user3] = signers
        // The EndpointV2Mock contract comes from @layerzerolabs/test-devtools-evm-hardhat package
        // and its artifacts are connected as external artifacts to this project
        const EndpointV2MockArtifact = await deployments.getArtifact('EndpointV2Mock')
        EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, endpointOwner)
    })

    beforeEach(async function () {
        // Deploying a mock LZEndpoint with the given Endpoint ID
        mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
        mockEndpointV2B = await EndpointV2Mock.deploy(eidB)
        // Deploying two instances of the TITN contract with different identifiers and linking them to the mock LZEndpoint
        baseTITN = await Titn.deploy(
            'baseTitn',
            'baseTITN',
            mockEndpointV2A.address,
            ownerA.address,
            ethers.utils.parseUnits('1000000000', 18)
        )
        arbTITN = await Titn.deploy(
            'arbTitn',
            'arbTITN',
            mockEndpointV2B.address,
            ownerA.address,
            ethers.utils.parseUnits('0', 18)
        )
        // Setting destination endpoints in the LZEndpoint mock for each TITN instance
        await mockEndpointV2A.setDestLzEndpoint(arbTITN.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(baseTITN.address, mockEndpointV2A.address)
        // Setting each TITN instance as a peer of the other in the mock LZEndpoint
        await baseTITN.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(arbTITN.address, 32))
        await arbTITN.connect(ownerA).setPeer(eidA, ethers.utils.zeroPad(baseTITN.address, 32))

        // Defining the amount of tokens to send and constructing the parameters for the send operation
        const tokensToSend = ethers.utils.parseEther(TITN_ARB_RAW)
        // Defining extra message execution options for the send operation
        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()
        const sendParam = [
            eidB,
            ethers.utils.zeroPad(ownerA.address, 32),
            tokensToSend,
            tokensToSend,
            options,
            '0x',
            '0x',
        ]
        // Fetching the native fee for the token send operation
        const [nativeFee] = await baseTITN.quoteSend(sendParam, false)
        // Executing the send operation from TITN contract
        await baseTITN.send(sendParam, [nativeFee, 0], ownerA.address, { value: nativeFee })

        // Deply MockTGT contract
        tgt = await Tgt.deploy('Tgt', 'TGT', ownerA.address, ethers.utils.parseUnits('1000000000', 18))

        // Deploy MergeTgt contract
        mergeTgt = await MergeTgt.deploy(tgt.address, arbTITN.address, ownerA.address)

        // Arbitrum setup
        await arbTITN.connect(ownerA).setTransferAllowedContract(mergeTgt.address)
        await mergeTgt.connect(ownerA).setLaunchTime()
        await mergeTgt.connect(ownerA).setLockedStatus(1)

        // now the admin should deposit all ARB.TITN into the mergeTGT contract
        await arbTITN.connect(ownerA).approve(mergeTgt.address, TITN_ARB)
        await mergeTgt.connect(ownerA).deposit(arbTITN.address, TITN_ARB)

        // let's send some TGT to user1 and user2
        await tgt.connect(ownerA).transfer(user1.address, ethers.utils.parseUnits('1000', 18))
        await tgt.connect(ownerA).transfer(user2.address, ethers.utils.parseUnits('1000', 18))
        await tgt.connect(ownerA).transfer(user3.address, ethers.utils.parseUnits('1000', 18))
    })

    describe('General tests', function () {
        it('should let a user to deposit TGT into the merge contract', async function () {
            // transfer TGT to the merge contract
            await tgt.connect(user1).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user1).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')
            // claim TITN
            const claimableAmount = await mergeTgt.claimableTitnPerUser(user1.address)
            const expected = await mergeTgt.quoteTitn(ethers.utils.parseEther('100'))
            expect(claimableAmount.toString()).to.be.equal(expected.toString())
            await mergeTgt.connect(user1).claimTitn(claimableAmount)
            const titnBalance = await arbTITN.balanceOf(user1.address)
            expect(titnBalance.toString()).to.be.equal(expected.toString())
        })
        it('should not let a user to transfer TITN tokens', async function () {
            // transfer TGT to the merge contract
            await tgt.connect(user1).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user1).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')
            // claim TITN
            const claimableAmount = await mergeTgt.claimableTitnPerUser(user1.address)
            await mergeTgt.connect(user1).claimTitn(claimableAmount)
            // attempt to transfer TITN (spoiler alert: it should fail)
            try {
                await arbTITN.connect(user1).transfer(user2.address, ethers.utils.parseUnits('1', 18))
                expect.fail('Transaction should have reverted')
            } catch (error: any) {
                expect(error.message).to.include('BridgedTokensTransferLocked')
            }
        })
        it('should not let a user to transfer TITN tokens', async function () {
            // transfer TGT to the merge contract
            await tgt.connect(user1).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user1).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')
            // claim TITN
            const claimableAmount = await mergeTgt.claimableTitnPerUser(user1.address)
            await mergeTgt.connect(user1).claimTitn(claimableAmount)
            // attempt to transfer TITN (spoiler alert: it should fail)
            try {
                await arbTITN.connect(user1).transfer(user2.address, ethers.utils.parseUnits('1', 18))
                expect.fail('Transaction should have reverted')
            } catch (error: any) {
                expect(error.message).to.include('BridgedTokensTransferLocked')
            }
        })
        it('should let a user to bridge TITN tokens to BASE', async function () {
            // transfer TGT to the merge contract
            await tgt.connect(user1).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user1).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')
            // claim TITN
            const claimableAmount = await mergeTgt.claimableTitnPerUser(user1.address)
            await mergeTgt.connect(user1).claimTitn(claimableAmount)

            // Attempt to bridge ARB.TITN to BASE.TITN
            // Defining extra message execution options for the send operation
            const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()
            const minAmount = claimableAmount.mul(999).div(1000)
            const sendParam = [
                eidA,
                ethers.utils.zeroPad(user1.address, 32),
                claimableAmount.toString(),
                minAmount.toString(),
                options,
                '0x',
                '0x',
            ]

            // Fetching the native fee for the token send operation
            const [nativeFee] = await arbTITN.quoteSend(sendParam, false)
            // Executing the send operation from TITN contract
            await arbTITN.connect(user1).send(sendParam, [nativeFee, 0], user1.address, { value: nativeFee })
            const balanceBase = await baseTITN.balanceOf(user1.address)
            const balanceArb = await arbTITN.balanceOf(user1.address)
            // their ARB balance should be 0 and their BASE balance should have increased
            const tolerance = ethers.utils.parseUnits('0.002', 18) // 0.002 TITN
            const diff = balanceBase.sub(claimableAmount).abs()
            expect(diff.lte(tolerance)).to.be.true
            const dustTolerance = ethers.utils.parseUnits('0.0002', 18)
            expect(balanceArb.lte(dustTolerance)).to.be.true // ✅ allows tiny remainder

            // they should not be able to transfer the BASE TITN
            try {
                await baseTITN.connect(user1).transfer(user2.address, ethers.utils.parseUnits('1', 18))
                expect.fail('Transaction should have reverted')
            } catch (error: any) {
                expect(error.message).to.include('BridgedTokensTransferLocked')
            }

            // but it the admin enables trading they should be able to transfer
            await baseTITN.connect(ownerA).setBridgedTokenTransferLocked(false)
            await baseTITN.connect(user1).transfer(user2.address, ethers.utils.parseUnits('1', 18))
            expect(await baseTITN.balanceOf(user2.address)).to.be.eql(ethers.utils.parseUnits('1', 18))
        })
    })
    describe('Time-based tests', function () {
        it('should get lower quotes after 90 days have elapsed', async function () {
            const amountOfTgtToDeposit = ethers.utils.parseUnits('1000', 18)
            const quote = await mergeTgt.quoteTitn(amountOfTgtToDeposit)

            const expected = amountOfTgtToDeposit.mul(TITN_ARB).div(TGT_TO_EXCHANGE)

            const diff = quote.sub(expected).abs()
            const tolerance = ethers.utils.parseUnits('0.001', 18)
            expect(diff.lte(tolerance)).to.be.true

            // Fast forward 89 days
            await time.increase(89 * 24 * 60 * 60)

            // before the 90 days have elapsed the quote should as high as day one
            const quote1 = await mergeTgt.quoteTitn(amountOfTgtToDeposit)
            const expected1 = amountOfTgtToDeposit.mul(TITN_ARB).div(TGT_TO_EXCHANGE)
            const diff1 = quote1.sub(expected1).abs()
            expect(diff1.lte(ethers.utils.parseUnits('0.001', 18))).to.be.true

            // Fast forward 2 days
            await time.increase(2 * 24 * 60 * 60)

            // after 90 days the quotes should be less than initially and get gradually lower as times goes by (until day 365)
            const quote2 = await mergeTgt.quoteTitn(amountOfTgtToDeposit)
            expect(quote2.lt(quote1)).to.be.true

            // Fast forward 30 days
            await time.increase(30 * 24 * 60 * 60)
            const quote3 = await mergeTgt.quoteTitn(amountOfTgtToDeposit)
            expect(quote3.lt(quote2)).to.be.true

            // // Fast forward 250 days
            await time.increase(250 * 24 * 60 * 60)
            const quote4 = Number(ethers.utils.formatUnits(await mergeTgt.quoteTitn(amountOfTgtToDeposit), 18))
            expect(quote4).to.be.eq(0)
        })
        it('should allow withdrawal of remaining TITN after 1 year', async function () {
            // user1 transfers TGT to the merge contract
            await tgt.connect(user1).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user1).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')

            // user2 transfers TGT to the merge contract
            await tgt.connect(user2).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user2).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')

            // user3 transfers TGT to the merge contract
            await tgt.connect(user3).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))
            await tgt.connect(user3).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')

            // user1 claims their TITN
            const claimableAmount = await mergeTgt.claimableTitnPerUser(user1.address)
            await mergeTgt.connect(user1).claimTitn(claimableAmount)

            const expectedQuote = await mergeTgt.quoteTitn(ethers.utils.parseUnits('100', 18))
            const actualBalance = await arbTITN.balanceOf(user1.address)
            const diff = expectedQuote.sub(actualBalance).abs()
            const tolerance = ethers.utils.parseUnits('0.001', 18) // Allow 0.001 TITN drift
            expect(diff.lte(tolerance)).to.be.true

            // user2 and user3 will wait 1 year and then try to withdraw their claimable amount + 50% of the remaining (unclaimed TITN)
            // Fast forward 365 days
            await time.increase(365 * 24 * 60 * 60)

            const availableTitn = await arbTITN.balanceOf(mergeTgt.address)
            const totalTitn = TITN_ARB
            const expectedAvailableTitn = totalTitn.sub(expectedQuote)
            const diff1 = availableTitn.sub(expectedAvailableTitn).abs()
            const tolerance1 = ethers.utils.parseUnits('0.001', 18)
            expect(diff1.lte(tolerance1)).to.be.true

            // user2 and user3 should be able to withdraw half of availableTitn each
            // Withdraw first
            await mergeTgt.connect(user2).withdrawRemainingTitn()
            const user2Balance = await arbTITN.balanceOf(user2.address)
            const user2Claimed = await mergeTgt.gettotalClaimedTitnPerUser(user2.address)

            // Assert they're equal (or close)
            const diff2 = user2Balance.sub(user2Claimed).abs()
            const tolerance2 = ethers.utils.parseUnits('0.001', 18)
            expect(diff2.lte(tolerance2)).to.be.true

            await mergeTgt.connect(user3).withdrawRemainingTitn()

            const user3Balance = await arbTITN.balanceOf(user3.address)
            const user3Claimed = await mergeTgt.gettotalClaimedTitnPerUser(user3.address)

            const diff3 = user3Balance.sub(user3Claimed).abs()
            const tolerance3 = ethers.utils.parseUnits('0.001', 18)
            expect(diff3.lte(tolerance3)).to.be.true
        })
        it('user locks TGT without claimable TITN if transfer on exactly day 360', async function () {
            await tgt.connect(user1).approve(mergeTgt.address, ethers.utils.parseUnits('100', 18))

            let launchTime = await mergeTgt.launchTime()

            // fast forward to just before exactly 360 days after launch
            await time.increaseTo(launchTime.toNumber() + (360 * 24 * 60 * 60 - 2))

            // transfer TGT to the merge contract at exactly 360 days after launchTime
            await tgt.connect(user1).transferAndCall(mergeTgt.address, ethers.utils.parseUnits('100', 18), '0x')

            // get claimable TITN
            const claimableAmount = await mergeTgt.claimableTitnPerUser(user1.address)

            // user can claim more than 0 TITN
            expect(claimableAmount.toNumber()).to.be.gt(0)
        })
    })
})
