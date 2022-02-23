import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Wallet } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { ZERO_ADDRESS } from '../../common/constants'
import { bn } from '../../common/numbers'
import {
  AaveLendingPoolMockP0,
  AssetP0,
  ComptrollerMockP0,
  DeployerP0,
  ERC20Mock,
  ExplorerFacadeP0,
  FurnaceP0,
  MainP0,
  MarketMock,
  RTokenAssetP0,
  RTokenP0,
  StRSRP0,
} from '../../typechain'
import { defaultFixture, IConfig, IRevenueShare } from './utils/fixtures'

const createFixtureLoader = waffle.createFixtureLoader

describe('DeployerP0 contract', () => {
  let owner: SignerWithAddress

  // Deployer contract
  let deployer: DeployerP0

  // RSR
  let rsr: ERC20Mock
  let rsrAsset: AssetP0

  // AAVE and Compound
  let compToken: ERC20Mock
  let compAsset: AssetP0
  let compoundMock: ComptrollerMockP0
  let aaveToken: ERC20Mock
  let aaveAsset: AssetP0
  let aaveMock: AaveLendingPoolMockP0

  // Market
  let market: MarketMock

  // Config values
  let config: IConfig
  let dist: IRevenueShare

  // Contracts to retrieve after deploy
  let rToken: RTokenP0
  let rTokenAsset: RTokenAssetP0
  let stRSR: StRSRP0
  let furnace: FurnaceP0
  let main: MainP0
  let facade: ExplorerFacadeP0

  let loadFixture: ReturnType<typeof createFixtureLoader>
  let wallet: Wallet

  before('create fixture loader', async () => {
    ;[wallet] = await (ethers as any).getSigners()
    loadFixture = createFixtureLoader([wallet])
  })

  beforeEach(async () => {
    ;[owner] = await ethers.getSigners()

    // Deploy fixture
    ;({
      rsr,
      rsrAsset,
      compToken,
      aaveToken,
      compAsset,
      aaveAsset,
      compoundMock,
      aaveMock,
      config,
      dist,
      deployer,
      main,
      rToken,
      rTokenAsset,
      furnace,
      stRSR,
      market,
      facade,
    } = await loadFixture(defaultFixture))
  })

  describe('Deployment', () => {
    it('Should setup values correctly', async () => {
      expect(await deployer.rsr()).to.equal(rsr.address)
      expect(await deployer.comp()).to.equal(compToken.address)
      expect(await deployer.aave()).to.equal(aaveToken.address)
      expect(await deployer.market()).to.equal(market.address)
      expect(await deployer.comptroller()).to.equal(compoundMock.address)
      expect(await deployer.aaveLendingPool()).to.equal(aaveMock.address)
    })

    it('Should deploy required contracts', async () => {
      expect(main.address).to.not.equal(ZERO_ADDRESS)
      expect(rsrAsset.address).to.not.equal(ZERO_ADDRESS)
      expect(compAsset.address).to.not.equal(ZERO_ADDRESS)
      expect(aaveAsset.address).to.not.equal(ZERO_ADDRESS)
      expect(rToken.address).to.not.equal(ZERO_ADDRESS)
      expect(rTokenAsset.address).to.not.equal(ZERO_ADDRESS)
      expect(furnace.address).to.not.equal(ZERO_ADDRESS)
      expect(stRSR.address).to.not.equal(ZERO_ADDRESS)
      expect(facade.address).to.not.equal(ZERO_ADDRESS)
    })

    it('Should register deployment', async () => {
      expect(await deployer.deployments(0)).to.equal(main.address)
    })

    it('Should setup Main correctly', async () => {
      // Owner/Pauser
      expect(await main.owner()).to.equal(owner.address)
      expect(await main.pauser()).to.equal(owner.address)

      // Assets
      // RSR
      expect(await main.assetFor(rsr.address)).to.equal(rsrAsset.address)
      expect(await rsrAsset.erc20()).to.equal(rsr.address)
      expect(await main.rsr()).to.equal(rsr.address)

      // RToken
      expect(await main.assetFor(rToken.address)).to.equal(rTokenAsset.address)
      expect(await rTokenAsset.erc20()).to.equal(rToken.address)
      expect(await main.rToken()).to.equal(rToken.address)

      // Check assets/collateral
      const assets = await main.allAssets()
      expect(assets[0]).to.equal(rTokenAsset.address)
      expect(assets[1]).to.equal(rsrAsset.address)
      expect(assets[2]).to.equal(aaveAsset.address)
      expect(assets[3]).to.equal(compAsset.address)
      expect(assets.length).to.eql((await main.basketCollateral()).length + 4)

      // Other components
      expect(await main.stRSR()).to.equal(stRSR.address)
      expect(await main.revenueFurnace()).to.equal(furnace.address)
    })

    it('Should setup RToken correctly', async () => {
      expect(await rToken.name()).to.equal('RTKN RToken')
      expect(await rToken.symbol()).to.equal('RTKN')
      expect(await rToken.decimals()).to.equal(18)
      expect(await rToken.totalSupply()).to.equal(bn(0))
      expect(await rToken.main()).to.equal(main.address)
    })

    it('Should setup Furnace correctly', async () => {
      expect(await furnace.rToken()).to.equal(rToken.address)
      expect(await furnace.batchDuration()).to.equal(config.rewardPeriod)
      expect(await furnace.owner()).to.equal(owner.address)
    })

    it('Should setup stRSR correctly', async () => {
      expect(await stRSR.main()).to.equal(main.address)
      expect(await stRSR.name()).to.equal('stRTKNRSR Token')
      expect(await stRSR.symbol()).to.equal('stRTKNRSR')
      expect(await stRSR.decimals()).to.equal(18)
      expect(await stRSR.totalSupply()).to.equal(0)
    })

    it('Should setup Facade correctly', async () => {
      expect(await facade.main()).to.equal(main.address)
    })
  })
})