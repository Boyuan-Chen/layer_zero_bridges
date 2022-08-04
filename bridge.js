const { ethers } = require("ethers");
require("dotenv").config();

const AltL1BridgeJson = require("./abi/AltL1Bridge.json");
const ETHL1BridgeJson = require("./abi/ETHBridge.json");
const Lib_ResolvedDelegateProxyJson = require("./abi/Lib_ResolvedDelegateProxy.json");
const L2StandardERC20Json = require("./abi/L2StandardERC20.json");
const LZEndpointMockJson = require("./abi/LZEndpointMock.json");

const ETH_CHAIN_URL = process.env.ETH_CHAIN_URL;
const TARGET_CHAIN_URL = process.env.TARGET_CHAIN_URL;

const LAYER_ZERO_ETH_ENDPOINT = process.env.LAYER_ZERO_ETH_ENDPOINT;
const LAYER_ZERO_TARGET_CHAIN_ENDPOINT =
  process.env.LAYER_ZERO_TARGET_CHAIN_ENDPOINT;
const LAYER_ZERO_ETH_CHAIN_ID = process.env.LAYER_ZERO_ETH_CHAIN_ID;
const LAYER_ZERO_ALT_L1_CHAIN_ID = process.env.LAYER_ZERO_ALT_L1_CHAIN_ID;

const ETH_DEPLOYER_PRIVATE_KEY = process.env.ETH_DEPLOYER_PRIVATE_KEY;

const ETH_L1_BRIDGE_ADDRESS = process.env.ETH_L1_BRIDGE_ADDRESS;
const PROXY_ETH_L1_BRIDGE_ADDRESS = process.env.PROXY_ETH_L1_BRIDGE_ADDRESS;

const ALT_L1_BRIDGE_ADDRESS = process.env.ALT_L1_BRIDGE_ADDRESS;
const PROXY_ALT_L1_BRIDGE_ADDRESS = process.env.PROXY_ALT_L1_BRIDGE_ADDRESS;

const ETH_L1_BOBA_ADDRESS = process.env.ETH_L1_BOBA_ADDRESS;
const ALT_L1_BOBA_ADDRESS = process.env.ALT_L1_BOBA_ADDRESS;

const main = async () => {
    if (!ETH_CHAIN_URL) {
        throw new Error("Must pass ETH_CHAIN_URL");
      }
      if (!TARGET_CHAIN_URL) {
        throw new Error("Must pass TARGET_CHAIN_URL");
      }
  if (!LAYER_ZERO_ETH_ENDPOINT) {
    throw new Error("Must pass LAYER_ZERO_ETH_ENDPOINT");
  }
  if (!LAYER_ZERO_TARGET_CHAIN_ENDPOINT) {
    throw new Error("Must pass LAYER_ZERO_TARGET_CHAIN_ENDPOINT");
  }
  if (!LAYER_ZERO_ETH_CHAIN_ID) {
    throw new Error("Must pass LAYER_ZERO_ETH_CHAIN_ID");
  }
  if (!LAYER_ZERO_ALT_L1_CHAIN_ID) {
    throw new Error("Must pass LAYER_ZERO_ALT_L1_CHAIN_ID");
  }
  if (!PROXY_ETH_L1_BRIDGE_ADDRESS) {
    throw new Error("Must pass PROXY_ETH_L1_BRIDGE_ADDRESS");
  }
  if (!PROXY_ALT_L1_BRIDGE_ADDRESS) {
    throw new Error("Must pass PROXY_ALT_L1_BRIDGE_ADDRESS");
  }
  if (!ETH_L1_BOBA_ADDRESS) {
    throw new Error("Must pass ETH_L1_BOBA_ADDRESS");
  }
  if (!ALT_L1_BOBA_ADDRESS) {
    throw new Error("Must pass ALT_L1_BOBA_ADDRESS");
  }
  if (!ETH_DEPLOYER_PRIVATE_KEY) {
    throw new Error("Must pass ETH_DEPLOYER_PRIVATE_KEY");
  }

  const ethWeb3 = new ethers.providers.JsonRpcProvider(ETH_CHAIN_URL);
  const altL1Webs = new ethers.providers.JsonRpcProvider(TARGET_CHAIN_URL);
  const ethWallet = new ethers.Wallet(ETH_DEPLOYER_PRIVATE_KEY).connect(ethWeb3);
  const altL1Wallet = new ethers.Wallet(ETH_DEPLOYER_PRIVATE_KEY).connect(altL1Webs);

  const Proxy__EthBridge = new ethers.Contract(
    PROXY_ETH_L1_BRIDGE_ADDRESS,
    ETHL1BridgeJson.abi,
    ethWallet
  );

  const Proxy__AltL1Bridge = new ethers.Contract(
    PROXY_ALT_L1_BRIDGE_ADDRESS,
    AltL1BridgeJson.abi,
    altL1Wallet
  );

  const EthBOBA = new ethers.Contract(
    ETH_L1_BOBA_ADDRESS,
    L2StandardERC20Json.abi,
    ethWallet
  );

  const AltL1BOBA = new ethers.Contract(
    ALT_L1_BOBA_ADDRESS,
    L2StandardERC20Json.abi,
    altL1Wallet
  );

  const ETHLayzerZeroEndpoint = new ethers.Contract(
    LAYER_ZERO_ETH_ENDPOINT,
    LZEndpointMockJson.abi,
    ethWallet
  );
  const AltL1LayerZeroEndpoint = new ethers.Contract(
    LAYER_ZERO_TARGET_CHAIN_ENDPOINT,
    LZEndpointMockJson.abi,
    altL1Wallet
  );

  let preEthBOBABalance = await EthBOBA.balanceOf(ethWallet.address);
  let preAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);

  console.log({
    preEthBOBABalance: ethers.utils.formatEther(preEthBOBABalance),
    preAltL1BOBABalance: ethers.utils.formatEther(preAltL1BOBABalance),
  });

  if (
    preEthBOBABalance.lt(ethers.BigNumber.from(ethers.utils.parseEther("0.5")))
  ) {
    throw new Error("EthBOBA balance is too low");
  }

  console.log(`Sending BOBA tokens From ETH to Alt L1....`);

  let approveTx = await EthBOBA.approve(
    Proxy__EthBridge.address,
    ethers.utils.parseEther("0.5")
  );
  await approveTx.wait();

  let payload = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "address", "address", "uint256", "bytes"],
    [
      ETH_L1_BOBA_ADDRESS,
      ALT_L1_BOBA_ADDRESS,
      ethWallet.address,
      altL1Wallet.address,
      ethers.utils.parseEther("0.5"),
      "0x",
    ]
  );

  let estimatedFee = await ETHLayzerZeroEndpoint.estimateFees(
    LAYER_ZERO_ALT_L1_CHAIN_ID,
    Proxy__EthBridge.address,
    payload,
    false,
    '0x'
  )

  console.log({ estimatedFee: ethers.utils.formatEther(estimatedFee._nativeFee) });

  await Proxy__EthBridge.depositERC20(
    ETH_L1_BOBA_ADDRESS,
    ALT_L1_BOBA_ADDRESS,
    ethers.utils.parseEther("0.5"),
    ethers.constants.AddressZero,
    '0x', // adapterParams
    '0x',
    { value: estimatedFee._nativeFee }
  )

  let postEthBOBABalance = await EthBOBA.balanceOf(ethWallet.address);
  let postAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);

  console.log({
    postEthBOBABalance: ethers.utils.formatEther(postEthBOBABalance),
    postAltL1BOBABalance: ethers.utils.formatEther(postAltL1BOBABalance),
  });

  let finalAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);
  while (finalAltL1BOBABalance.eq(postAltL1BOBABalance)) {
    await sleep(15000);
    console.log({
        finalAltL1BOBABalance: ethers.utils.formatEther(finalAltL1BOBABalance),
        postAltL1BOBABalance: ethers.utils.formatEther(postAltL1BOBABalance),
    })
    finalAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);
  }

  console.log(`\nSucceeded - BOBA Token is transferred to ALT L1!\n`)
  console.log({
    finalAltL1BOBABalance: ethers.utils.formatEther(finalAltL1BOBABalance),
    postAltL1BOBABalance: ethers.utils.formatEther(postAltL1BOBABalance),
  })


  preEthBOBABalance = await EthBOBA.balanceOf(ethWallet.address);
  preAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);

  console.log({
    preEthBOBABalance: ethers.utils.formatEther(preEthBOBABalance),
    preAltL1BOBABalance: ethers.utils.formatEther(preAltL1BOBABalance),
  });

  if (
    preAltL1BOBABalance.lt(ethers.BigNumber.from(ethers.utils.parseEther("0.5")))
  ) {
    throw new Error("AltBOBA balance is too low");
  }

  console.log(`\nSending BOBA tokens From Alt L1 to Alt ETH....`);

  approveTx = await AltL1BOBA.approve(
    Proxy__AltL1Bridge.address,
    ethers.utils.parseEther("0.5")
  );
  await approveTx.wait();

  payload = ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "address", "address", "uint256", "bytes"],
    [
      ETH_L1_BOBA_ADDRESS,
      ALT_L1_BOBA_ADDRESS,
      ethWallet.address,
      altL1Wallet.address,
      ethers.utils.parseEther("0.5"),
      "0x",
    ]
  );

  estimatedFee = await AltL1LayerZeroEndpoint.estimateFees(
    LAYER_ZERO_ETH_CHAIN_ID,
    Proxy__AltL1Bridge.address,
    payload,
    false,
    '0x'
  )

  console.log({ estimatedFee: ethers.utils.formatEther(estimatedFee._nativeFee) });

  await Proxy__AltL1Bridge.withdraw(
    ALT_L1_BOBA_ADDRESS,
    ethers.utils.parseEther("0.5"),
    ethers.constants.AddressZero,
    '0x', // adapterParams
    '0x',
    { value: estimatedFee._nativeFee }
  )

  postEthBOBABalance = await EthBOBA.balanceOf(ethWallet.address);
  postAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);

  console.log({
    postEthBOBABalance: ethers.utils.formatEther(postEthBOBABalance),
    postAltL1BOBABalance: ethers.utils.formatEther(postAltL1BOBABalance),
  });

  let finalEthL1BOBABalance = await EthBOBA.balanceOf(altL1Wallet.address);
  while (finalEthL1BOBABalance.eq(postEthBOBABalance)) {
    await sleep(15000);
    console.log({
        finalEthL1BOBABalance: ethers.utils.formatEther(finalEthL1BOBABalance),
        postEthBOBABalance: ethers.utils.formatEther(postEthBOBABalance),
    })
    finalEthL1BOBABalance = await EthBOBA.balanceOf(altL1Wallet.address);
  }

  console.log(`\nSucceeded - BOBA Token is transferred to ETH L1!\n`)
  console.log({
    finalEthL1BOBABalance: ethers.utils.formatEther(finalEthL1BOBABalance),
    postEthBOBABalance: ethers.utils.formatEther(postEthBOBABalance),
  })


  preEthBOBABalance = await EthBOBA.balanceOf(ethWallet.address);
  preAltL1BOBABalance = await AltL1BOBA.balanceOf(altL1Wallet.address);

  console.log({
    preEthBOBABalance: ethers.utils.formatEther(preEthBOBABalance),
    preAltL1BOBABalance: ethers.utils.formatEther(preAltL1BOBABalance),
  });
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main();
