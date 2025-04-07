import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'

const RECIPIENT_1_PERCENT = 10
const RECIPIENT_2_PERCENT = 30
const RECIPIENT_3_PERCENT = 60

describe('ERC20Splitter3Way tests', function () {
    // Other variables to be used in the test suite
    let Usdc: ContractFactory
    let ERC20Splitter: ContractFactory
    let ownerA: SignerWithAddress
    let ownerB: SignerWithAddress
    let user1: SignerWithAddress
    let user2: SignerWithAddress
    let user3: SignerWithAddress
    let usdc: Contract
    let erc20Splitter: Contract
    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        Usdc = await ethers.getContractFactory('Usdc')
        ERC20Splitter = await ethers.getContractFactory('ERC20Splitter3Way')
        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners()
        ;[ownerA, ownerB, user1, user2, user3] = signers
        // The EndpointV2Mock contract comes from @layerzerolabs/test-devtools-evm-hardhat package
        // and its artifacts are connected as external artifacts to this project
    })

    beforeEach(async function () {
        // Deploy USDC
        usdc = await Usdc.deploy('USDC', 'USDC', ownerA.address, ethers.utils.parseUnits('1000000000', 18))

        // Deploy Splitter contract
        erc20Splitter = await ERC20Splitter.deploy()
        await erc20Splitter.connect(ownerA).setToken(usdc.address)
        await erc20Splitter
            .connect(ownerA)
            .setRecipients(
                [user1.address, user2.address, user3.address],
                [RECIPIENT_1_PERCENT, RECIPIENT_2_PERCENT, RECIPIENT_3_PERCENT]
            )
    })

    describe('General tests', function () {
        it('should have set the correct token', async function () {
            const tokenAddress = await erc20Splitter.token()
            expect(tokenAddress).to.be.equal(usdc.address)
        })
        it('should have set the correct recipients and their share', async function () {
            expect(await erc20Splitter.recipients(0)).to.be.equal(user1.address)
            expect(await erc20Splitter.recipients(1)).to.be.equal(user2.address)
            expect(await erc20Splitter.recipients(2)).to.be.equal(user3.address)
            expect((await erc20Splitter.percentages(0)).toString()).to.be.equal(RECIPIENT_1_PERCENT.toString())
            expect((await erc20Splitter.percentages(1)).toString()).to.be.equal(RECIPIENT_2_PERCENT.toString())
            expect((await erc20Splitter.percentages(2)).toString()).to.be.equal(RECIPIENT_3_PERCENT.toString())
        })
        it('should receive USDC', async function () {
            await usdc.transfer(erc20Splitter.address, ethers.utils.parseUnits('100000', 18))
            await erc20Splitter.distribute()
            expect((await usdc.balanceOf(user1.address)).toString()).to.be.equal(
                ethers.utils.parseUnits(((100000 / 100) * RECIPIENT_1_PERCENT).toString(), 18).toString()
            )
            expect((await usdc.balanceOf(user2.address)).toString()).to.be.equal(
                ethers.utils.parseUnits(((100000 / 100) * RECIPIENT_2_PERCENT).toString(), 18).toString()
            )
            expect((await usdc.balanceOf(user3.address)).toString()).to.be.equal(
                ethers.utils.parseUnits(((100000 / 100) * RECIPIENT_3_PERCENT).toString(), 18).toString()
            )
        })
    })
})
