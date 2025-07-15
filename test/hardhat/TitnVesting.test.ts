import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers, network } from 'hardhat'

import chai from 'chai'
import { solidity } from 'ethereum-waffle'
chai.use(solidity)

describe('TitnVesting logic tests', function () {
    let TitnVesting: ContractFactory
    let vesting: Contract
    let startTimestamp: number
    const totalVestingSupply = ethers.utils.parseEther('1000')
    const defaultDuration = 60 * 60 * 24 * 30 // 30 days

    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1
    const eidB = 2
    // Other variables to be used in the test suite
    let Titn: ContractFactory
    let EndpointV2Mock: ContractFactory
    let ownerA: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let baseTITN: Contract
    let arbTITN: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract
    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        Titn = await ethers.getContractFactory('Titn')
        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners()
        ;[ownerA, endpointOwner, user1, user2] = signers
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

        TitnVesting = await ethers.getContractFactory('TitnVesting')
        const now = await time.latest()
        startTimestamp = now + 100 // 100 seconds in the future

        // Deploy TitnVesting contract
        vesting = await TitnVesting.deploy(baseTITN.address, startTimestamp, defaultDuration)

        // we only do this for the test to pass
        // the issue is that the hardhat config has set arbitrum as the chain it runs on
        // which is fine for all other tests but this one is on base
        // but the tests thinks we are on arbitrum which has more TITN transfer
        // restrictions, we can simulate no restrictions by disabling the
        // bridged token restrictions
        await baseTITN.connect(ownerA).setBridgedTokenTransferLocked(false)
    })

    it('should allow owner to set a vesting schedule', async () => {
        // Step 1: fund vesting contract
        await baseTITN.connect(ownerA).transfer(vesting.address, totalVestingSupply)
        // Step 2: owner assigns vesting to user1
        await vesting.connect(ownerA).vest([user1.address], [ethers.utils.parseEther('100')])
        expect(await baseTITN.balanceOf(vesting.address)).to.equal(totalVestingSupply)
    })

    it('should allow user1 to claim a third of their tokens after 10 days', async () => {
        const vestedAmount = ethers.utils.parseEther('300') // 300 TITN
        const tenDays = 60 * 60 * 24 * 10 // seconds

        // Step 1: fund vesting contract
        await baseTITN.connect(ownerA).transfer(vesting.address, vestedAmount)

        // Step 2: owner assigns vesting to user1
        await vesting.connect(ownerA).vest([user1.address], [vestedAmount])

        // Step 3: move time forward to just after vesting starts
        const timeUntilStart = startTimestamp - (await time.latest()) + 1
        if (timeUntilStart > 0) {
            await time.increase(timeUntilStart)
        }

        await time.increase(tenDays) // ⏩ simulate 10 days of vesting

        // Step 5: check claimable
        const claimable = await vesting.canClaim(user1.address)
        const expectedClaimable = ethers.utils.parseEther('100') // ⅓ of 300

        // Allow a small margin of error for rounding (if any)
        expect(claimable).to.be.closeTo(expectedClaimable, ethers.utils.parseEther('0.01'))

        // Step 5: claim it
        await expect(vesting.connect(user1).claim(user1.address, claimable))
            .to.emit(vesting, 'Claim')
            .withArgs(user1.address, claimable)

        // Step 6: verify balance received and vesting state updated
        const balance = await baseTITN.balanceOf(user1.address)
        expect(balance).to.equal(claimable)

        const remaining = await vesting.vestedBalanceOf(user1.address)
        expect(remaining).to.equal(vestedAmount.sub(claimable))

        console.log((await baseTITN.balanceOf(user1.address)).toString(), '<-----------')
        await baseTITN.connect(user1).transfer(user2.address, claimable)
        console.log((await baseTITN.balanceOf(user1.address)).toString(), '<-----------')
        console.log((await baseTITN.balanceOf(user2.address)).toString(), '<-----------')
    })
})
