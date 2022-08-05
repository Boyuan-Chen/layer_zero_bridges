const { ethers } = require("ethers");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const AltL1BridgeJson = require("./abi/AltL1Bridge.json");
const ETHL1BridgeJson = require("./abi/ETHBridge.json");
const Lib_ResolvedDelegateProxyJson = require("./abi/Lib_ResolvedDelegateProxy.json");
const L2StandardERC20Json = require("./abi/L2StandardERC20.json");

const ETH_CHAIN_URL = process.env.ETH_CHAIN_URL;
const TARGET_CHAIN_URL = process.env.TARGET_CHAIN_URL;
const LAYER_ZERO_ETH_ENDPOINT = process.env.LAYER_ZERO_ETH_ENDPOINT;
const LAYER_ZERO_TARGET_CHAIN_ENDPOINT =
  process.env.LAYER_ZERO_TARGET_CHAIN_ENDPOINT;
const LAYER_ZERO_ETH_CHAIN_ID = process.env.LAYER_ZERO_ETH_CHAIN_ID;
const LAYER_ZERO_ALT_L1_CHAIN_ID = process.env.LAYER_ZERO_ALT_L1_CHAIN_ID;

const LAYER_ZERO_CHAIN_NAME = process.env.LAYER_ZERO_CHAIN_NAME;

const ETH_DEPLOYER_PRIVATE_KEY = process.env.ETH_DEPLOYER_PRIVATE_KEY;
const ALT_L1_DEPLOYER_PRIVATE_KEY = process.env.ALT_L1_DEPLOYER_PRIVATE_KEY;

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
  if (!LAYER_ZERO_CHAIN_NAME) {
    throw new Error("Must pass LAYER_ZERO_CHAIN_NAME");
  }
  if (!ETH_DEPLOYER_PRIVATE_KEY) {
    throw new Error("Must pass ETH_DEPLOYER_PRIVATE_KEY");
  }
  if (!ALT_L1_DEPLOYER_PRIVATE_KEY) {
    throw new Error("Must pass ALT_L1_DEPLOYER_PRIVATE_KEY");
  }
  if (!ETH_L1_BOBA_ADDRESS) {
    throw new Error("Must pass ETH_L1_BOBA_ADDRESS");
  }

  const ethWallet = new ethers.Wallet(ETH_DEPLOYER_PRIVATE_KEY);
  const altL1Wallet = new ethers.Wallet(ALT_L1_DEPLOYER_PRIVATE_KEY);

  const ETHContracts = await deployETHContract();
  const Proxy__EthBridge = ETHContracts[0];
  const EthBridge = ETHContracts[1];

  const AltL1Contracts = await deployAltL1Contract();
  const Proxy__AltL1Bridge = AltL1Contracts[0];
  const AltL1Bridge = AltL1Contracts[1];

  if (!ETH_L1_BRIDGE_ADDRESS || !PROXY_ETH_L1_BRIDGE_ADDRESS) {
    console.warn(
      "ETH_L1_BRIDGE_ADDRESS or PROXY_ETH_L1_BRIDGE_ADDRESS is empty"
    );
    console.warn("Initializing ETH L1 Bridge contracts...");

    // Initialize proxy contract
    const initProxyEthBridgeTX = await Proxy__EthBridge.initialize(
      LAYER_ZERO_ETH_ENDPOINT, // current chain layerZero endpoint
      LAYER_ZERO_ALT_L1_CHAIN_ID, // destination (layerZero) chainId
      Proxy__AltL1Bridge.address // the other bridge
    );
    await initProxyEthBridgeTX.wait();
    console.log(`Proxy__EthBridge initialized: ${initProxyEthBridgeTX.hash}`);
  }

  if (!ALT_L1_BRIDGE_ADDRESS || !PROXY_ALT_L1_BRIDGE_ADDRESS) {
    console.warn(
      "ALT_L1_BRIDGE_ADDRESS or PROXY_ALT_L1_BRIDGE_ADDRESS is empty"
    );
    console.warn("Initializing Alt L1 Bridge contracts...");

    // Initialize proxy contract
    const initProxyAltL1BridgeTX = await Proxy__AltL1Bridge.initialize(
      LAYER_ZERO_TARGET_CHAIN_ENDPOINT, // current chain layerZero endpoint
      LAYER_ZERO_ETH_CHAIN_ID, // destination (layerZero) chainId
      Proxy__EthBridge.address // the other bridge
    );
    await initProxyAltL1BridgeTX.wait();
    console.log(
      `Proxy__AltL1Bridge initialized: ${initProxyAltL1BridgeTX.hash}`
    );
  }

  console.log("Deployment completed");
  console.log(`Verifying bridge contracts...`);

  if ((await Proxy__EthBridge.owner()) !== ethWallet.address) {
    throw new Error("Proxy__EthBridge Owner mismatch");
  }
  if ((await Proxy__AltL1Bridge.owner()) !== altL1Wallet.address) {
    throw new Error("Proxy__AltL1Bridge Owner mismatch");
  }
  // check initialization
  if (
    (await Proxy__EthBridge.dstChainId()).toString() !==
    LAYER_ZERO_ALT_L1_CHAIN_ID.toString()
  ) {
    throw new Error("Proxy__EthBridge chainId mismatch");
  }
  if (
    (await Proxy__AltL1Bridge.dstChainId()).toString() !==
    LAYER_ZERO_ETH_CHAIN_ID.toString()
  ) {
    throw new Error("Proxy__AltL1Bridge chainId mismatch");
  }
  if (
    (await Proxy__EthBridge.trustedRemoteLookup(LAYER_ZERO_ALT_L1_CHAIN_ID)) !==
    Proxy__AltL1Bridge.address.toLowerCase()
  ) {
    throw new Error("Proxy__EthBridge trustedRemote mismatch");
  }
  if (
    (await Proxy__AltL1Bridge.trustedRemoteLookup(LAYER_ZERO_ETH_CHAIN_ID)) !==
    Proxy__EthBridge.address.toLowerCase()
  ) {
    throw new Error("Proxy__AltL1Bridge trustedRemote mismatch");
  }

  const BOBA = await deployAltBOBAContract(Proxy__AltL1Bridge.address);

  console.log(`Verifying BOBA contract...`);
  if ((await BOBA.l2Bridge()) !== Proxy__AltL1Bridge.address) {
    throw new Error("BOBA l2Bridge mismatch");
  }
  if ((await BOBA.name()) !== "BOBA Token") {
    throw new Error("BOBA name mismatch");
  }
  if ((await BOBA.decimals()) !== 18) {
    throw new Error("BOBA decimals mismatch");
  }
  if ((await BOBA.symbol()) !== "BOBA") {
    throw new Error("BOBA symbol mismatch");
  }

  const payload = {
    Proxy__AltL1Bridge: Proxy__AltL1Bridge.address,
    AltL1Bridge: AltL1Bridge.address,
    Proxy__EthBridge: Proxy__EthBridge.address,
    EthBridge: EthBridge.address,
    AltL1BOBA: BOBA.address,
    ETHBOBA: ETH_L1_BOBA_ADDRESS,
  }
  const dumpsPath = path.resolve(__dirname, "./addresses");
  const addrsPath = path.resolve(dumpsPath, `${LAYER_ZERO_CHAIN_NAME}.json`);
  await fs.promises.writeFile(addrsPath, JSON.stringify(payload));

  console.log(`\nSucceeded!\n`)
  console.log(payload)
};

const deployETHContract = async () => {
  const web3 = new ethers.providers.JsonRpcProvider(ETH_CHAIN_URL);
  const wallet = new ethers.Wallet(ETH_DEPLOYER_PRIVATE_KEY).connect(web3);

  if (!ETH_L1_BRIDGE_ADDRESS || !PROXY_ETH_L1_BRIDGE_ADDRESS) {
    console.warn(
      "ETH_L1_BRIDGE_ADDRESS or PROXY_ETH_L1_BRIDGE_ADDRESS is empty"
    );
    console.warn("Deploying ETH L1 Bridge contracts...");
    const Factory__EthBridge = new ethers.ContractFactory(
      ETHL1BridgeJson.abi,
      ETHL1BridgeJson.bytecode,
      wallet
    );
    const EthBridge = await Factory__EthBridge.deploy();
    await EthBridge.deployTransaction.wait();
    console.log(`EthBridge deployed to: ${EthBridge.address}`);

    const Factory__Proxy__EthBridge = new ethers.ContractFactory(
      Lib_ResolvedDelegateProxyJson.abi,
      Lib_ResolvedDelegateProxyJson.bytecode,
      wallet
    );

    let Proxy__EthBridge = await Factory__Proxy__EthBridge.deploy(
      EthBridge.address
    );
    await Proxy__EthBridge.deployTransaction.wait();
    console.log(`Proxy__EthBridge deployed to: ${Proxy__EthBridge.address}`);

    Proxy__EthBridge = new ethers.Contract(
      Proxy__EthBridge.address,
      ETHL1BridgeJson.abi,
      wallet
    );

    return [Proxy__EthBridge, EthBridge];
  }

  const EthBridge = new ethers.Contract(
    ETH_L1_BRIDGE_ADDRESS,
    ETHL1BridgeJson.abi,
    wallet
  );

  const Proxy__EthBridge = new ethers.Contract(
    PROXY_ETH_L1_BRIDGE_ADDRESS,
    ETHL1BridgeJson.abi,
    wallet
  );
  return [Proxy__EthBridge, EthBridge];
};

const deployAltL1Contract = async () => {
  const web3 = new ethers.providers.JsonRpcProvider(TARGET_CHAIN_URL);
  const wallet = new ethers.Wallet(ALT_L1_DEPLOYER_PRIVATE_KEY).connect(web3);

  if (!ALT_L1_BRIDGE_ADDRESS || !PROXY_ALT_L1_BRIDGE_ADDRESS) {
    console.warn(
      "ALT_L1_BRIDGE_ADDRESS or PROXY_ALT_L1_BRIDGE_ADDRESS is empty"
    );
    console.warn("Deploying ALT L1 Bridge contracts...");
    const Factory__AltL1Bridge = new ethers.ContractFactory(
      AltL1BridgeJson.abi,
      AltL1BridgeJson.bytecode,
      wallet
    );
    const AltL1Bridge = await Factory__AltL1Bridge.deploy();
    await AltL1Bridge.deployTransaction.wait();
    console.log(`AltL1Bridge deployed to: ${AltL1Bridge.address}`);

    const Factory__Proxy__AltL1Bridge = new ethers.ContractFactory(
      Lib_ResolvedDelegateProxyJson.abi,
      Lib_ResolvedDelegateProxyJson.bytecode,
      wallet
    );

    let Proxy__AltL1Bridge = await Factory__Proxy__AltL1Bridge.deploy(
      AltL1Bridge.address
    );
    await Proxy__AltL1Bridge.deployTransaction.wait();
    console.log(
      `Proxy__AltL1Bridge deployed to: ${Proxy__AltL1Bridge.address}`
    );

    Proxy__AltL1Bridge = new ethers.Contract(
      Proxy__AltL1Bridge.address,
      AltL1BridgeJson.abi,
      wallet
    );

    return [Proxy__AltL1Bridge, AltL1Bridge];
  }

  const AltL1Bridge = new ethers.Contract(
    ALT_L1_BRIDGE_ADDRESS,
    AltL1BridgeJson.abi,
    wallet
  );

  const Proxy__AltL1Bridge = new ethers.Contract(
    PROXY_ALT_L1_BRIDGE_ADDRESS,
    AltL1BridgeJson.abi,
    wallet
  );
  return [Proxy__AltL1Bridge, AltL1Bridge];
};

const deployAltBOBAContract = async (AltL1BridgeAddress) => {
  const ethWeb3 = new ethers.providers.JsonRpcProvider(ETH_CHAIN_URL);
  const altL1Webs = new ethers.providers.JsonRpcProvider(TARGET_CHAIN_URL);
  const ethWallet = new ethers.Wallet(ETH_DEPLOYER_PRIVATE_KEY).connect(
    ethWeb3
  );
  const altL1Wallet = new ethers.Wallet(ALT_L1_DEPLOYER_PRIVATE_KEY).connect(
    altL1Webs
  );

  if (!ALT_L1_BOBA_ADDRESS) {
    console.warn(`ALT_L1_BOBA_ADDRESS is empty`);
    console.warn(`Deploying ALT L1 BOBA contracts...`);
    const Factory__L2StandardERC20 = new ethers.ContractFactory(
      L2StandardERC20Json.abi,
      L2StandardERC20Json.bytecode,
      altL1Wallet
    );
    const BOBA = await Factory__L2StandardERC20.deploy(
      AltL1BridgeAddress,
      ETH_L1_BOBA_ADDRESS,
      "BOBA Token",
      "BOBA",
      18
    );
    await BOBA.deployTransaction.wait();

    console.log(`BOBA deployed to: ${BOBA.address}`);

    return BOBA;
  }

  return new ethers.Contract(
    ALT_L1_BOBA_ADDRESS,
    L2StandardERC20Json.abi,
    altL1Wallet
  );
};

main();
