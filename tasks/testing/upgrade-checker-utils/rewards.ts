import { fp } from '#/common/numbers'
import { TradeKind } from '#/common/constants'
import { whileImpersonating } from '#/utils/impersonation'
import { advanceBlocks, advanceTime } from '#/utils/time'
import { IRewardable } from '@typechain/IRewardable'
import { formatEther } from 'ethers/lib/utils'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { runBatchTrade } from '../upgrade-checker-utils/trades'

const claimRewards = async (claimer: IRewardable) => {
  const resp = await claimer.claimRewards()
  const r = await resp.wait()
  const rewards = []
  for (const event of r.events!) {
    if (event.event == 'RewardsClaimed' && event.args!.amount.gt(0)) {
      rewards.push(event.args!.erc20)
    }
  }
  return rewards
}

export const claimRsrRewards = async (hre: HardhatRuntimeEnvironment, rtokenAddress: string) => {
  console.log(`\n* * * * * Claiming RSR rewards...`)
  const rToken = await hre.ethers.getContractAt('RTokenP1', rtokenAddress)
  const main = await hre.ethers.getContractAt('IMain', await rToken.main())
  const backingManager = await hre.ethers.getContractAt(
    'BackingManagerP1',
    await main.backingManager()
  )
  const rsrTrader = await hre.ethers.getContractAt('RevenueTraderP1', await main.rsrTrader())
  const rsr = await hre.ethers.getContractAt('ERC20Mock', await main.rsr())
  const strsr = await hre.ethers.getContractAt('StRSRP1', await main.stRSR())
  const rsrRatePre = await strsr.exchangeRate()

  const rewards = await claimRewards(backingManager)
  console.log('rewards claimed', rewards)
  await backingManager.forwardRevenue(rewards)
  const comp = '0xc00e94Cb662C3520282E6f5717214004A7f26888'
  const compContract = await hre.ethers.getContractAt('ERC20Mock', comp)

  // fake enough rewards to trade
  await whileImpersonating(hre, '0x73AF3bcf944a6559933396c1577B257e2054D935', async (compWhale) => {
    await compContract.connect(compWhale).transfer(rsrTrader.address, fp('1e5'))
  })

  await rsrTrader.manageTokens([comp], [TradeKind.BATCH_AUCTION])
  await runBatchTrade(hre, rsrTrader, comp, false)
  await rsrTrader.manageTokens([rsr.address], [TradeKind.BATCH_AUCTION])
  await strsr.payoutRewards()
  await advanceBlocks(hre, 100)
  await advanceTime(hre, 1200)
  await strsr.payoutRewards()

  const rsrRatePost = await strsr.exchangeRate()
  if (!rsrRatePost.gt(rsrRatePre)) {
    throw new Error(
      `stRSR rate should have increased. pre: ${formatEther(rsrRatePre)}   post ${formatEther(
        rsrRatePost
      )}`
    )
  }

  console.log('Successfully claimed and distributed RSR rewards')
}
