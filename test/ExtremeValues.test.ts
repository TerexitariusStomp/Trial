import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, ContractFactory, Wallet } from 'ethers'
import { ethers, waffle } from 'hardhat'
import {
  BN_SCALE_FACTOR,
  FURNACE_DEST,
  STRSR_DEST,
  MAX_UINT256,
  CollateralStatus,
} from '../common/constants'
import { bn, fp, shortString } from '../common/numbers'
import {
  AaveLendingPoolMock,
  AavePricedAsset,
  AaveOracleMock,
  AssetRegistryP0,
  ATokenFiatCollateral,
  BackingManagerP0,
  AavePricedFiatCollateral,
  BasketHandlerP0,
  CompoundPricedAsset,
  ComptrollerMock,
  CompoundOracleMock,
  CTokenFiatCollateral,
  AavePricedFiatCollateralMock,
  CTokenMock,
  DistributorP0,
  ERC20Mock,
  FacadeP0,
  GnosisTrade,
  MainP0,
  GnosisMock,
  RevenueTradingP0,
  RTokenAsset,
  TestIRToken,
  StaticATokenMock,
  USDCMock,
} from '../typechain'
import { whileImpersonating } from './utils/impersonation'
import { advanceTime } from './utils/time'
import { Collateral, defaultFixture, IConfig, SLOW } from './fixtures'
import { cartesianProduct } from './utils/cases'
import { issueMany } from './utils/issue'

const createFixtureLoader = waffle.createFixtureLoader

describe(`Extreme Values (${SLOW ? 'slow mode' : 'fast mode'})`, () => {
  let owner: SignerWithAddress
  let addr1: SignerWithAddress
  let addr2: SignerWithAddress

  // Non-backing assets
  let rsr: ERC20Mock
  let compToken: ERC20Mock
  let compoundMock: ComptrollerMock
  let aaveToken: ERC20Mock
  let aaveMock: AaveLendingPoolMock
  let compoundOracleInternal: CompoundOracleMock
  let aaveOracleInternal: AaveOracleMock

  // Trading
  let rsrTrader: RevenueTradingP0
  let rTokenTrader: RevenueTradingP0

  // Tokens and Assets
  let initialBal: BigNumber
  let token0: ERC20Mock
  let token1: USDCMock
  let token2: StaticATokenMock
  let token3: CTokenMock
  let collateral0: Collateral
  let collateral1: Collateral
  let collateral2: ATokenFiatCollateral
  let collateral3: CTokenFiatCollateral
  let basket: Collateral[]

  // Config values
  let config: IConfig

  // Contracts to retrieve after deploy
  let rToken: TestIRToken
  let main: MainP0
  let facade: FacadeP0
  let assetRegistry: AssetRegistryP0
  let backingManager: BackingManagerP0
  let basketHandler: BasketHandlerP0
  let distributor: DistributorP0

  let loadFixture: ReturnType<typeof createFixtureLoader>
  let wallet: Wallet

  before('create fixture loader', async () => {
    ;[wallet] = (await ethers.getSigners()) as unknown as Wallet[]
    loadFixture = createFixtureLoader([wallet])
  })

  beforeEach(async () => {
    ;[owner, addr1, addr2] = await ethers.getSigners()

    // Deploy fixture
    ;({
      rsr,
      compToken,
      aaveToken,
      compoundMock,
      aaveMock,
      basket,
      config,
      main,
      assetRegistry,
      backingManager,
      basketHandler,
      distributor,
      rToken,
      facade,
      rsrTrader,
      rTokenTrader,
      compoundOracleInternal,
      aaveOracleInternal,
    } = await loadFixture(defaultFixture))

    // Set backingBuffer to 0 to make math easy
    await backingManager.connect(owner).setBackingBuffer(0)

    // Get assets and tokens
    collateral0 = <Collateral>basket[0]
    collateral1 = <Collateral>basket[1]
    collateral2 = <ATokenFiatCollateral>basket[2]
    collateral3 = <CTokenFiatCollateral>basket[3]
    token0 = <ERC20Mock>await ethers.getContractAt('ERC20Mock', await collateral0.erc20())
    token1 = <USDCMock>await ethers.getContractAt('USDCMock', await collateral1.erc20())
    token2 = <StaticATokenMock>(
      await ethers.getContractAt('StaticATokenMock', await collateral2.erc20())
    )
    token3 = <CTokenMock>await ethers.getContractAt('CTokenMock', await collateral3.erc20())

    // Mint initial balances
    initialBal = bn('1000000e18')
    await token0.connect(owner).mint(addr1.address, initialBal)
    await token1.connect(owner).mint(addr1.address, initialBal)
    await token2.connect(owner).mint(addr1.address, initialBal)
    await token3.connect(owner).mint(addr1.address, initialBal)

    await token0.connect(owner).mint(addr2.address, initialBal)
    await token1.connect(owner).mint(addr2.address, initialBal)
    await token2.connect(owner).mint(addr2.address, initialBal)
    await token3.connect(owner).mint(addr2.address, initialBal)
  })

  const defaultThreshold = fp('0.05') // 5%
  const delayUntilDefault = bn('86400') // 24h
  const maxUoA = fp('1e26')
  let ERC20Mock: ContractFactory
  let ATokenMockFactory: ContractFactory
  let CTokenMockFactory: ContractFactory
  let ATokenCollateralFactory: ContractFactory
  let CTokenCollateralFactory: ContractFactory

  beforeEach(async function () {
    ERC20Mock = await ethers.getContractFactory('ERC20Mock')
    ATokenMockFactory = await ethers.getContractFactory('StaticATokenMock')
    CTokenMockFactory = await ethers.getContractFactory('CTokenMock')
    ATokenCollateralFactory = await ethers.getContractFactory('ATokenFiatCollateral')
    CTokenCollateralFactory = await ethers.getContractFactory('CTokenFiatCollateral')
  })

  const prepAToken = async (
    index: number,
    maxTradeVolume?: BigNumber
  ): Promise<StaticATokenMock> => {
    const underlying: ERC20Mock = <ERC20Mock>(
      await ERC20Mock.deploy(`ERC20_NAME:${index}`, `ERC20_SYM:${index}`)
    )
    await compoundOracleInternal.setPrice(await underlying.symbol(), bn('1e6'))
    await aaveOracleInternal.setPrice(underlying.address, bn('2.5e14'))
    const erc20: StaticATokenMock = <StaticATokenMock>(
      await ATokenMockFactory.deploy(
        `StaticAToken_NAME:${index}`,
        `StaticAToken_SYM:${index}`,
        underlying.address
      )
    )

    // Set reward token
    await erc20.setAaveToken(aaveToken.address)
    const collateral = <ATokenFiatCollateral>(
      await ATokenCollateralFactory.deploy(
        erc20.address,
        maxTradeVolume ? maxTradeVolume : maxUoA,
        defaultThreshold,
        delayUntilDefault,
        underlying.address,
        compoundMock.address,
        aaveMock.address,
        aaveToken.address
      )
    )
    await assetRegistry.connect(owner).register(collateral.address)
    return erc20
  }

  const prepCToken = async (index: number, maxTradeVolume?: BigNumber): Promise<CTokenMock> => {
    const underlying: ERC20Mock = <ERC20Mock>(
      await ERC20Mock.deploy(`ERC20_NAME:${index}`, `ERC20_SYM:${index}`)
    )
    await compoundOracleInternal.setPrice(await underlying.symbol(), bn('1e6'))
    const erc20: CTokenMock = <CTokenMock>(
      await CTokenMockFactory.deploy(
        `CToken_NAME:${index}`,
        `CToken_SYM:${index}`,
        underlying.address
      )
    )
    const collateral = <CTokenFiatCollateral>(
      await CTokenCollateralFactory.deploy(
        erc20.address,
        maxTradeVolume ? maxTradeVolume : maxUoA,
        defaultThreshold,
        delayUntilDefault,
        underlying.address,
        compoundMock.address,
        compToken.address
      )
    )
    await assetRegistry.connect(owner).register(collateral.address)
    return erc20
  }

  const doCommonSetup = async (stRSRCut: BigNumber) => {
    // Configure Distributor
    const rsrDist = bn(5).mul(stRSRCut).div(fp('1'))
    const rTokenDist = bn(5).mul(fp('1').sub(stRSRCut)).div(fp('1'))
    expect(rsrDist.add(rTokenDist)).to.equal(5)
    await expect(
      distributor
        .connect(owner)
        .setDistribution(STRSR_DEST, { rTokenDist: bn(0), rsrDist: rsrDist })
    )
      .to.emit(distributor, 'DistributionSet')
      .withArgs(STRSR_DEST, bn(0), rsrDist)
    await expect(
      distributor
        .connect(owner)
        .setDistribution(FURNACE_DEST, { rTokenDist: rTokenDist, rsrDist: bn(0) })
    )
      .to.emit(distributor, 'DistributionSet')
      .withArgs(FURNACE_DEST, rTokenDist, bn(0))

    // Eliminate auction frictions
    await backingManager.connect(owner).setDustAmount(0)
    await rsrTrader.connect(owner).setDustAmount(0)
    await rTokenTrader.connect(owner).setDustAmount(0)

    // Set prices
    await compoundOracleInternal.setPrice(await rsr.symbol(), bn('1e6'))
    await aaveOracleInternal.setPrice(rsr.address, bn('2.5e14'))
    await compoundOracleInternal.setPrice(await aaveToken.symbol(), bn('1e6'))
    await aaveOracleInternal.setPrice(aaveToken.address, bn('2.5e14'))
    await compoundOracleInternal.setPrice(await compToken.symbol(), bn('1e6'))

    // Replace RSR and RToken assets with larger maxTradeVolume settings
    const RTokenAssetFactory: ContractFactory = await ethers.getContractFactory('RTokenAsset')
    const RSRAssetFactory: ContractFactory = await ethers.getContractFactory('AavePricedAsset')
    const newRTokenAsset: RTokenAsset = <RTokenAsset>(
      await RTokenAssetFactory.deploy(rToken.address, maxUoA, main.address)
    )
    const newRSRAsset: AavePricedAsset = <AavePricedAsset>(
      await RSRAssetFactory.deploy(
        compToken.address,
        maxUoA,
        compoundMock.address,
        aaveMock.address
      )
    )
    await assetRegistry.connect(owner).swapRegistered(newRTokenAsset.address)
    await assetRegistry.connect(owner).swapRegistered(newRSRAsset.address)
  }

  const runAuctionsForAllTraders = async () => {
    let didStuff = true
    // Run auctions
    while (didStuff) {
      didStuff = false
      // Close auctions
      await facade.runAuctionsForAllTraders()

      expect(await backingManager.numTrades()).to.equal(0)
      const traders = [rsrTrader, rTokenTrader]
      for (const trader of traders) {
        const lastClosedTrade = await trader.tradesStart()
        const totalTrades = await trader.numTrades()
        for (let i = lastClosedTrade; i.lt(totalTrades); i = i.add(1)) {
          didStuff = true
          const trade = <GnosisTrade>(
            await ethers.getContractAt('GnosisTrade', await trader.trades(i))
          )
          const gnosis = <GnosisMock>await ethers.getContractAt('GnosisMock', await trade.gnosis())
          const auctionId = await trade.auctionId()
          const [, , buy, sellAmt, buyAmt] = await gnosis.auctions(auctionId)
          expect(buy == rToken.address || buy == rsr.address)
          if (buy == rToken.address) {
            await whileImpersonating(backingManager.address, async (bmSigner) => {
              await rToken.connect(bmSigner).mint(addr1.address, buyAmt)
            })
            await rToken.connect(addr1).approve(gnosis.address, buyAmt)
            await gnosis.placeBid(auctionId, {
              bidder: addr1.address,
              sellAmount: sellAmt,
              buyAmount: buyAmt,
            })
          } else if (buy == rsr.address) {
            await rsr.connect(owner).mint(addr2.address, buyAmt)
            await rsr.connect(addr2).approve(gnosis.address, buyAmt)
            await gnosis.placeBid(auctionId, {
              bidder: addr2.address,
              sellAmount: sellAmt,
              buyAmount: buyAmt,
            })
          }
        }
      }

      // Advance time till auction ends
      await advanceTime(config.auctionLength.add(100).toString())
    }
  }

  context('Appreciation', function () {
    // STORY
    //
    // There are N apppreciating collateral in the basket.
    // Between 1 and N collateral appreciate X% (assume 0% backingBuffer)
    // Launch up to 2-2N auctions using surplus collateral for RSR/RToken.
    // Give result to Furnace/StRSR.
    //
    // DIMENSIONS
    //
    // 1. RToken supply
    // 2. Size of basket
    // 3. Prime basket weights
    // 4. # of decimals in collateral token
    // 5. Exchange rate after appreciation
    // 6. Max trade volume
    // 7. Symmetry of appreciation (evenly vs all in 1 collateral)
    // 8. StRSR cut (previously: f)

    async function runScenario(
      rTokenSupply: BigNumber,
      basketSize: number,
      primeWeight: BigNumber,
      collateralDecimals: number,
      appreciationExchangeRate: BigNumber,
      maxTradeVolume: BigNumber,
      howManyAppreciate: number,
      stRSRCut: BigNumber
    ) {
      await doCommonSetup(stRSRCut)

      const primeBasket = []
      const targetAmts = []
      for (let i = 0; i < basketSize; i++) {
        expect(collateralDecimals == 8 || collateralDecimals == 18).to.equal(true)
        const token =
          collateralDecimals == 8
            ? await prepCToken(i, maxTradeVolume)
            : await prepAToken(i, maxTradeVolume)
        primeBasket.push(token)
        targetAmts.push(primeWeight.div(basketSize).add(1))
        await token.setExchangeRate(fp('1'))
        await token.connect(owner).mint(addr1.address, MAX_UINT256)
        await token.connect(addr1).approve(rToken.address, MAX_UINT256)
      }

      // Setup basket
      await basketHandler.connect(owner).setPrimeBasket(
        primeBasket.map((c) => c.address),
        targetAmts
      )
      await basketHandler.connect(owner).switchBasket()

      // Issue rTokens
      await issueMany(rToken, rTokenSupply, addr1)
      expect(await rToken.balanceOf(addr1.address)).to.equal(rTokenSupply)

      // === Execution ===

      // Increase redemption rate
      for (let i = 0; i < primeBasket.length && i < howManyAppreciate; i++) {
        await primeBasket[i].setExchangeRate(appreciationExchangeRate)
      }

      await runAuctionsForAllTraders()
    }

    let dimensions
    if (SLOW) {
      dimensions = [
        [fp('1e-6'), fp('1e30')], // RToken supply
        [1, 256], // basket size
        [fp('1e-6'), fp('1e3'), fp('1')], // prime basket weights
        [8, 18], // collateral decimals
        [fp('0'), fp('1e9'), fp('0.02')], // exchange rate at appreciation
        [bn('1e6'), maxUoA], // maxTradeVolume
        [1, 256], // how many collateral assets appreciate (up to)
        [fp('0'), fp('1'), fp('0.6')], // StRSR cut (f)
      ]
    } else {
      dimensions = [
        [fp('1e-6'), fp('1e30')], // RToken supply
        [7], // basket size
        [fp('1e-6'), fp('1e3')], // prime basket weights
        [8, 18], // collateral decimals
        [fp('1e9')], // exchange rate at appreciation
        [maxUoA], // maxTradeVolume
        [1], // how many collateral assets appreciate (up to)
        [fp('0.6')], // StRSR cut (f)
      ]
    }

    const cases = cartesianProduct(...dimensions)

    const numCases = cases.length.toString()
    cases.forEach((params, index) => {
      it(`case ${index + 1} of ${numCases}: ${params.map(shortString).join(' ')}`, async () => {
        await runScenario(
          params[0] as BigNumber,
          params[1] as number,
          params[2] as BigNumber,
          params[3] as number,
          params[4] as BigNumber,
          params[5] as BigNumber,
          params[6] as number,
          params[7] as BigNumber
        )
      })
    })
  })
  context('Rewards', function () {
    // STORY
    //
    // There are N reward-earning collateral in the basket.
    // A total amount of Y rewards is earned
    // Launch 1-2 auctions using rewards, for RSR/RToken.
    // Give result to Furnace/StRSR.
    //
    // DIMENSIONS
    //
    // 1. RToken supply (including this in order to check 0 supply case)
    // 2. Size of reward-earning basket tokens
    // 3. Number of reward tokens (1 or 2)
    // 4. Size of reward
    // 5. StRSR cut (previously: f)

    async function runScenario(
      rTokenSupply: BigNumber,
      basketSize: number,
      numRewardTokens: number,
      rewardTok: BigNumber, // whole tokens
      stRSRCut: BigNumber
    ) {
      await doCommonSetup(stRSRCut)

      // Replace registered reward assets with large maxTradeVolume assets
      const AaveAssetFactory: ContractFactory = await ethers.getContractFactory('AavePricedAsset')
      const CompoundAssetFactory: ContractFactory = await ethers.getContractFactory(
        'CompoundPricedAsset'
      )
      const newAaveAsset: AavePricedAsset = <AavePricedAsset>(
        await AaveAssetFactory.deploy(
          aaveToken.address,
          maxUoA,
          compoundMock.address,
          aaveMock.address
        )
      )
      const newCompAsset: CompoundPricedAsset = <CompoundPricedAsset>(
        await CompoundAssetFactory.deploy(compToken.address, maxUoA, compoundMock.address)
      )
      await assetRegistry.connect(owner).swapRegistered(newAaveAsset.address)
      await assetRegistry.connect(owner).swapRegistered(newCompAsset.address)

      // Set up prime basket
      const primeBasket = []
      const targetAmts = []
      for (let i = 0; i < basketSize; i++) {
        expect(numRewardTokens == 1 || numRewardTokens == 2).to.equal(true)
        let token
        if (numRewardTokens == 1) {
          token = await prepCToken(i)
        } else {
          token = i % 2 == 0 ? await prepCToken(i) : await prepAToken(i)
        }
        primeBasket.push(token)
        targetAmts.push(fp('1').div(basketSize))
        await token.setExchangeRate(fp('1'))
        await token.connect(owner).mint(addr1.address, MAX_UINT256)
        await token.connect(addr1).approve(rToken.address, MAX_UINT256)
      }

      // Setup basket
      await basketHandler.connect(owner).setPrimeBasket(
        primeBasket.map((token) => token.address),
        targetAmts
      )
      await expect(basketHandler.connect(owner).switchBasket()).to.emit(basketHandler, 'BasketSet')

      // Issue rTokens
      await issueMany(rToken, rTokenSupply, addr1)
      expect(await rToken.balanceOf(addr1.address)).to.equal(rTokenSupply)

      // === Execution ===

      // Grant rewards
      for (let i = 0; i < primeBasket.length; i++) {
        const decimals = await primeBasket[i].decimals()
        expect(decimals == 8 || decimals == 18).to.equal(true)
        if (decimals == 8) {
          // cToken
          const oldRewards = await compoundMock.compBalances(backingManager.address)
          const newRewards = rewardTok.mul(bn('1e8')).div(numRewardTokens)

          await compoundMock.setRewards(backingManager.address, oldRewards.add(newRewards))
        } else if (decimals == 18) {
          // aToken
          const aToken = <StaticATokenMock>primeBasket[i]
          const rewards = rewardTok.mul(bn('1e18')).div(numRewardTokens)
          await aToken.setRewards(backingManager.address, rewards)
        }
      }

      // Claim rewards
      await expect(backingManager.claimAndSweepRewards()).to.emit(backingManager, 'RewardsClaimed')

      // Do auctions
      await runAuctionsForAllTraders()
    }

    let dimensions
    if (SLOW) {
      dimensions = [
        [fp('1e-6'), fp('1e30')], // RToken supply
        [1, 256], // basket size
        [1, 2], // num reward tokens
        [bn('0'), bn('1e11'), bn('1e6')], // reward amount (whole tokens), up to 100B supply tokens
        [fp('0'), fp('1'), fp('0.6')], // StRSR cut (f)
      ]
    } else {
      dimensions = [
        [fp('1e-6'), fp('1e30')], // RToken supply
        [1, 7], // basket size
        [2], // num reward tokens
        [bn('1e11')], // reward amount (whole tokens), up to 100B supply tokens
        [fp('0.6')], // StRSR cut (f)
      ]
    }
    const cases = cartesianProduct(...dimensions)

    const numCases = cases.length.toString()
    cases.forEach((params, index) => {
      it(`case ${index + 1} of ${numCases}: ${params.map(shortString).join(' ')}`, async () => {
        await runScenario(
          params[0] as BigNumber,
          params[1] as number,
          params[2] as number,
          params[3] as BigNumber,
          params[4] as BigNumber
        )
      })
    })
  })

  context('Basket Switching', function () {
    let ERC20: ContractFactory
    let AaveCollateralFactory: ContractFactory
    let firstCollateral: AavePricedFiatCollateralMock | undefined

    // Dimensions
    //
    // 1. Number of prime basket tokens
    // 2. Number of backup tokens
    // 3. Number of target units
    // 4. Asset.targetPerRef
    // 5. Asset.price TODO check again
    // 6. TargetAmts to BUs

    const runSimulation = async (
      numPrimeTokens: number,
      numBackupTokens: number,
      targetUnits: number,
      targetPerRefs: BigNumber,
      basketTargetAmt: BigNumber
    ) => {
      ERC20 = await ethers.getContractFactory('ERC20Mock')
      AaveCollateralFactory = await ethers.getContractFactory('AavePricedFiatCollateralMock')

      firstCollateral = undefined
      const makeToken = async (
        tokenName: string,
        targetUnit: string,
        targetPerRef: BigNumber
      ): Promise<ERC20Mock> => {
        const erc20: ERC20Mock = <ERC20Mock>await ERC20.deploy(tokenName, `${tokenName} symbol`)
        const collateral: AavePricedFiatCollateralMock = <AavePricedFiatCollateralMock>(
          await AaveCollateralFactory.deploy(
            erc20.address,
            config.maxTradeVolume,
            fp('0.05'),
            bn('86400'),
            compoundMock.address,
            aaveMock.address,
            targetUnit,
            targetPerRef
          )
        )

        if (firstCollateral === undefined) firstCollateral = collateral
        await assetRegistry.register(collateral.address)
        await aaveOracleInternal.setPrice(erc20.address, targetPerRef)
        return erc20
      }

      ;({ assetRegistry, basketHandler, compoundMock, aaveMock } = await loadFixture(
        defaultFixture
      ))

      const primeERC20s = []
      const targetAmts = []
      for (let i = 0; i < numPrimeTokens; i++) {
        const targetUnit = ethers.utils.formatBytes32String((i % targetUnits).toString())
        const erc20 = await makeToken(`Token ${i}`, targetUnit, targetPerRefs)
        primeERC20s.push(erc20.address)
        targetAmts.push(basketTargetAmt.div(targetUnits))
      }

      const backups: [string[]] = [[]]
      for (let i = 1; i < targetUnits; i++) {
        backups.push([])
      }
      for (let i = 0; i < numBackupTokens; i++) {
        const index = i % targetUnits
        const targetUnit = ethers.utils.formatBytes32String(index.toString())

        // reuse erc20 if possible
        const erc20Addr =
          i < numPrimeTokens
            ? primeERC20s[i]
            : (await makeToken(`Token ${i}`, targetUnit, targetPerRefs)).address
        backups[index].push(erc20Addr)
      }
      for (let i = 0; i < targetUnits; i++) {
        const targetUnit = ethers.utils.formatBytes32String(i.toString())
        await basketHandler.setBackupConfig(targetUnit, numPrimeTokens, backups[i])
      }

      // Set prime basket with all collateral
      await basketHandler.setPrimeBasket(primeERC20s, targetAmts)
      await basketHandler.connect(owner).switchBasket()

      // Unregister collateral and switch basket
      if (firstCollateral !== undefined) {
        firstCollateral = <AavePricedFiatCollateralMock>firstCollateral

        // Unregister calls `ensureValidBasket`
        await assetRegistry.unregister(firstCollateral.address)
      }
    }

    const size = SLOW ? 256 : 4 // Currently 256 takes >5 minutes to execute 32 cases

    const primeTokens = [size, 0]

    const backupTokens = [size, 0]

    const targetUnits = [size, 1]

    // 1e18 range centered around the expected case of fp('1')
    const targetPerRefs = [fp('1e-9'), fp('1e9')]

    // min weight: 0, max weight: 1000
    const basketTargetAmts = [fp('0'), fp('1e3')]

    const dimensions = [primeTokens, backupTokens, targetUnits, targetPerRefs, basketTargetAmts]

    // 2^5 = 32 cases
    const cases = cartesianProduct(...dimensions)
    const numCases = cases.length.toString()
    cases.forEach((params, index) => {
      it(`case ${index + 1} of ${numCases}: ${params.map(shortString).join(' ')}`, async () => {
        await runSimulation(
          params[0] as number,
          params[1] as number,
          params[2] as number,
          params[3] as BigNumber,
          params[4] as BigNumber
        )
      })
    })
  })

  context(`RToken`, () => {
    // makeColl: Deploy and register a new constant-price collateral
    async function makeColl(index: number | string, price: BigNumber): Promise<ERC20Mock> {
      const ERC20: ContractFactory = await ethers.getContractFactory('ERC20Mock')
      const erc20: ERC20Mock = <ERC20Mock>await ERC20.deploy('Token ' + index, 'T' + index)
      const AaveCollateralFactory: ContractFactory = await ethers.getContractFactory(
        'AavePricedFiatCollateral'
      )
      const coll: AavePricedFiatCollateral = <AavePricedFiatCollateral>(
        await AaveCollateralFactory.deploy(
          erc20.address,
          fp('1e36'),
          fp('0.05'),
          bn(86400),
          compoundMock.address,
          aaveMock.address
        )
      )
      await assetRegistry.register(coll.address) // SHOULD BE LINTED
      expect(await assetRegistry.isRegistered(erc20.address)).to.be.true
      await aaveOracleInternal.setPrice(erc20.address, price)
      return erc20
    }

    async function forceUpdateGetStatus(): Promise<CollateralStatus> {
      await whileImpersonating(basketHandler.address, async (bhSigner) => {
        await assetRegistry.connect(bhSigner).forceUpdates()
      })
      return basketHandler.status()
    }

    async function runScenario([
      toIssue,
      toRedeem,
      totalSupply, // in this scenario, rtoken supply _after_ issuance.
      numBasketAssets,
      weightFirst, // target amount per asset (weight of first asset)
      weightRest, // another target amount per asset (weight of second+ assets)
      issuanceRate, // range under test: [.000_001 to 1.0]
    ]: BigNumber[]) {
      // skip nonsense cases
      if (
        (numBasketAssets.eq(1) && !weightRest.eq(1)) ||
        toRedeem.gt(totalSupply) ||
        toIssue.gt(totalSupply)
      ) {
        return
      }

      // ==== Deploy and register basket collateral

      const N = numBasketAssets.toNumber()
      const erc20s: ERC20Mock[] = []
      const weights: BigNumber[] = []
      let totalWeight: BigNumber = fp(0)
      for (let i = 0; i < N; i++) {
        const erc20 = await makeColl(i, fp('0.00025'))
        erc20s.push(erc20)
        const currWeight = i == 0 ? weightFirst : weightRest
        weights.push(currWeight)
        totalWeight = totalWeight.add(currWeight)
      }
      expect(await forceUpdateGetStatus()).to.equal(CollateralStatus.SOUND)

      // ==== Switch Basket

      const basketAddresses: string[] = erc20s.map((erc20) => erc20.address)
      await basketHandler.connect(owner).setPrimeBasket(basketAddresses, weights)
      await basketHandler.connect(owner).switchBasket()
      expect(await forceUpdateGetStatus()).to.equal(CollateralStatus.SOUND)

      for (let i = 0; i < basketAddresses.length; i++) {
        expect(await basketHandler.quantity(basketAddresses[i])).to.equal(weights[i])
      }

      // ==== Mint basket tokens to owner and addr1

      const toIssue0 = totalSupply.sub(toIssue)
      const e18 = BN_SCALE_FACTOR
      for (let i = 0; i < N; i++) {
        const erc20: ERC20Mock = erc20s[i]
        // user owner starts with enough basket assets to issue (totalSupply - toIssue)
        const toMint0: BigNumber = toIssue0.mul(weights[i]).add(e18.sub(1)).div(e18)
        await erc20.mint(owner.address, toMint0)
        await erc20.connect(owner).increaseAllowance(rToken.address, toMint0)

        // user addr1 starts with enough basket assets to issue (toIssue)
        const toMint: BigNumber = toIssue.mul(weights[i]).add(e18.sub(1)).div(e18)
        await erc20.mint(addr1.address, toMint)
        await erc20.connect(addr1).increaseAllowance(rToken.address, toMint)
      }

      await rToken.connect(owner).setIssuanceRate(issuanceRate)

      // ==== Issue the "initial" rtoken supply to owner

      expect(await rToken.balanceOf(owner.address)).to.equal(bn(0))
      await issueMany(rToken, toIssue0, owner)
      expect(await rToken.balanceOf(owner.address)).to.equal(toIssue0)

      // ==== Issue the toIssue supply to addr1

      expect(await rToken.balanceOf(addr1.address)).to.equal(0)
      await issueMany(rToken, toIssue, addr1)
      expect(await rToken.balanceOf(addr1.address)).to.equal(toIssue)

      // ==== Send enough rTokens to addr2 that it can redeem the amount `toRedeem`

      // owner has toIssue0 rToken, addr1 has toIssue rToken.
      if (toRedeem.lte(toIssue0)) {
        await rToken.connect(owner).transfer(addr2.address, toRedeem)
      } else {
        await rToken.connect(owner).transfer(addr2.address, toIssue0)
        await rToken.connect(addr1).transfer(addr2.address, toRedeem.sub(toIssue0))
      }
      expect(await rToken.balanceOf(addr2.address)).to.equal(toRedeem)

      // ==== Redeem tokens

      await rToken.connect(addr2).redeem(toRedeem)
      expect(await rToken.balanceOf(addr2.address)).to.equal(0)
    }

    // ==== Generate the tests
    const MAX_RTOKENS = bn('1e48') // TODO: should be 1e36, but I know that throws error for now...
    const MAX_WEIGHT = fp(1000)
    const MIN_WEIGHT = fp('1e-6')
    const MIN_ISSUANCE_FRACTION = fp('1e-6')

    let paramList

    if (SLOW) {
      const bounds: BigNumber[][] = [
        [bn(1), MAX_RTOKENS, bn('1.205e24')], // toIssue
        [bn(1), MAX_RTOKENS, bn('4.4231e24')], // toRedeem
        [MAX_RTOKENS, bn('7.907e24')], // totalSupply
        [bn(1), bn(3)], // numAssets
        [MIN_WEIGHT, MAX_WEIGHT, fp('0.1')], // weightFirst
        [MIN_WEIGHT, MAX_WEIGHT, fp('0.2')], // weightRest
        [fp('0.00025'), fp(1), MIN_ISSUANCE_FRACTION], // issuanceRate
      ]

      // A few big heavy test cases
      const bounds2: BigNumber[][] = [
        [MAX_RTOKENS, bn(1)],
        [MAX_RTOKENS, bn(1)],
        [MAX_RTOKENS],
        [bn(255)],
        [MAX_WEIGHT, MIN_WEIGHT],
        [MAX_WEIGHT, MIN_WEIGHT],
        [fp('0.1')],
      ]

      paramList = cartesianProduct(...bounds).concat(cartesianProduct(...bounds2))
    } else {
      const bounds: BigNumber[][] = [
        [bn(1), MAX_RTOKENS], // toIssue
        [bn(1), MAX_RTOKENS], // toRedeem
        [MAX_RTOKENS], // totalSupply
        [bn(1)], // numAssets
        [MIN_WEIGHT, MAX_WEIGHT], // weightFirst
        [MIN_WEIGHT], // weightRest
        [MIN_ISSUANCE_FRACTION, fp(1)], // issuanceRate
      ]
      paramList = cartesianProduct(...bounds)
    }
    const numCases = paramList.length.toString()
    paramList.forEach((params, index) => {
      it(`case ${index + 1} of ${numCases}: ${params.map(shortString).join(' ')}`, async () => {
        await runScenario(params)
      })
    })
  })
})
