import { bn, fp } from '../../../../common/numbers'
import { networkConfig } from '../../../../common/configuration'

// Mainnet Addresses

// DAI
export const DAI_USD_FEED = networkConfig['1'].chainlinkFeeds.DAI!
export const DAI_ORACLE_TIMEOUT = bn('86400')
export const DAI_ORACLE_ERROR = fp('0.0025')

// USDC
export const USDC_USD_FEED = networkConfig['1'].chainlinkFeeds.USDC!
export const USDC_ORACLE_TIMEOUT = bn('86400')
export const USDC_ORACLE_ERROR = fp('0.0025')

// USDT
export const USDT_USD_FEED = networkConfig['1'].chainlinkFeeds.USDT!
export const USDT_ORACLE_TIMEOUT = bn('86400')
export const USDT_ORACLE_ERROR = fp('0.0025')

// SUSD
export const SUSD_USD_FEED = networkConfig['1'].chainlinkFeeds.sUSD!
export const SUSD_ORACLE_TIMEOUT = bn('86400')
export const SUSD_ORACLE_ERROR = fp('0.0025')

// FRAX
export const FRAX_USD_FEED = networkConfig['1'].chainlinkFeeds.FRAX!
export const FRAX_ORACLE_TIMEOUT = bn('3600')
export const FRAX_ORACLE_ERROR = fp('0.01')

// WBTC
export const WBTC_BTC_FEED = networkConfig['1'].chainlinkFeeds.WBTC!
export const BTC_USD_FEED = networkConfig['1'].chainlinkFeeds.BTC!
export const WBTC_ORACLE_TIMEOUT = bn('86400')
export const BTC_ORACLE_TIMEOUT = bn('3600')
export const WBTC_BTC_ORACLE_ERROR = fp('0.02')
export const BTC_USD_ORACLE_ERROR = fp('0.005')

// WETH
export const WETH_USD_FEED = networkConfig['1'].chainlinkFeeds.ETH!
export const WETH_ORACLE_TIMEOUT = bn('86400')
export const WETH_ORACLE_ERROR = fp('0.005')

// MIM
export const MIM_USD_FEED = networkConfig['1'].chainlinkFeeds.MIM!
export const MIM_ORACLE_TIMEOUT = bn('86400')
export const MIM_ORACLE_ERROR = fp('0.005') // 0.5%
export const MIM_DEFAULT_THRESHOLD = fp('0.055') // 5.5%

// crvUSD
export const crvUSD_USD_FEED = networkConfig['1'].chainlinkFeeds.crvUSD!
export const crvUSD_ORACLE_TIMEOUT = bn('86400')
export const crvUSD_ORACLE_ERROR = fp('0.005')

// pyUSD
export const pyUSD_USD_FEED = networkConfig['1'].chainlinkFeeds.pyUSD!
export const pyUSD_ORACLE_TIMEOUT = bn('86400')
export const pyUSD_ORACLE_ERROR = fp('0.003')

// Tokens
export const DAI = networkConfig['1'].tokens.DAI!
export const USDC = networkConfig['1'].tokens.USDC!
export const USDT = networkConfig['1'].tokens.USDT!
export const SUSD = networkConfig['1'].tokens.sUSD!
export const FRAX = networkConfig['1'].tokens.FRAX!
export const MIM = networkConfig['1'].tokens.MIM!
export const eUSD = networkConfig['1'].tokens.eUSD!
export const WETH = networkConfig['1'].tokens.WETH!
export const WBTC = networkConfig['1'].tokens.WBTC!
export const crvUSD = networkConfig['1'].tokens.crvUSD!
export const pyUSD = networkConfig['1'].tokens.pyUSD!

export const RSR = networkConfig['1'].tokens.RSR!
export const CRV = networkConfig['1'].tokens.CRV!
export const CVX = networkConfig['1'].tokens.CVX!

// 3pool - USDC, USDT, DAI
export const THREE_POOL = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7'
export const THREE_POOL_TOKEN = '0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490'
export const THREE_POOL_CVX_POOL_ID = 9
export const THREE_POOL_HOLDER = '0xd632f22692fac7611d2aa1c0d552930d43caed3b'
export const THREE_POOL_DEFAULT_THRESHOLD = fp('0.0125') // 1.25%
export const THREE_POOL_GAUGE = '0xbfcf63294ad7105dea65aa58f8ae5be2d9d0952a'

// tricrypto2 - USDT, WBTC, ETH
export const TRI_CRYPTO = '0xd51a44d3fae010294c616388b506acda1bfaae46'
export const TRI_CRYPTO_TOKEN = '0xc4ad29ba4b3c580e6d59105fff484999997675ff'
export const TRI_CRYPTO_CVX_POOL_ID = 38
export const TRI_CRYPTO_HOLDER = '0xDeFd8FdD20e0f34115C7018CCfb655796F6B2168'
export const TRI_CRYPTO_GAUGE = '0xdefd8fdd20e0f34115c7018ccfb655796f6b2168'

// SUSD Pool - USDC, USDT, DAI, SUSD (used for tests only)
export const SUSD_POOL = '0xa5407eae9ba41422680e2e00537571bcc53efbfd'
export const SUSD_POOL_TOKEN = '0xC25a3A3b969415c80451098fa907EC722572917F'
export const SUSD_POOL_CVX_POOL_ID = 4
export const SUSD_POOL_HOLDER = '0xDCB6A51eA3CA5d3Fd898Fd6564757c7aAeC3ca92'
export const SUSD_POOL_DEFAULT_THRESHOLD = fp('0.0125') // 1.25%

// fraxBP
export const FRAX_BP = '0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2'
export const FRAX_BP_TOKEN = '0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC'

// eUSD + fraxBP -- this metapool combines lpToken + curvePool
export const eUSD_FRAX_BP = '0xAEda92e6A3B1028edc139A4ae56Ec881f3064D4F'
export const eUSD_FRAX_BP_POOL_ID = 156
export const eUSD_FRAX_HOLDER = '0x8605dc0C339a2e7e85EEA043bD29d42DA2c6D784'
export const eUSD_GAUGE = '0x8605dc0c339a2e7e85eea043bd29d42da2c6d784'

// MIM + 3pool
export const MIM_THREE_POOL = '0x5a6A4D54456819380173272A5E8E9B9904BdF41B'
export const MIM_THREE_POOL_POOL_ID = 40
export const MIM_THREE_POOL_HOLDER = '0x66C90baCE2B68955C875FdA89Ba2c5A94e672440'
export const MIM_THREE_POOL_GAUGE = '0xd8b712d29381748db89c36bca0138d7c75866ddf'

// crvUSD/USDC
export const crvUSD_USDC = '0x4dece678ceceb27446b35c672dc7d61f30bad69e'
export const crvUSD_USDC_POOL_ID = 182
export const crvUSD_USDC_HOLDER = '0x95f00391cB5EebCd190EB58728B4CE23DbFa6ac1'
export const crvUSD_USDC_GAUGE = '0x95f00391cB5EebCd190EB58728B4CE23DbFa6ac1'

// PayPool
export const PayPool = '0x383e6b4437b59fff47b619cba855ca29342a8559'
export const PayPool_POOL_ID = 270
export const PayPool_HOLDER = '0x9da75997624C697444958aDeD6790bfCa96Af19A'
export const PayPool_GAUGE = '0x9da75997624c697444958aded6790bfca96af19a'

// Curve-specific
export const CURVE_MINTER = '0xd061d61a4d941c39e5453435b6345dc261c2fce0'

// RTokenMetapool-specific
export const RTOKEN_DELAY_UNTIL_DEFAULT = bn('259200') // 72h

// Common
export const FIX_ONE = 1n * 10n ** 18n
export const PRICE_TIMEOUT = bn('604800') // 1 week
export const DEFAULT_THRESHOLD = fp('0.02') // 2%
export const DELAY_UNTIL_DEFAULT = bn('86400')
export const MAX_TRADE_VOL = fp('1e6')

// export const FORK_BLOCK = 15850930 // TODO delete after confirming all cvx tests still passing
export const FORK_BLOCK = 16915576

export enum CurvePoolType {
  Plain,
  Lending,
}
