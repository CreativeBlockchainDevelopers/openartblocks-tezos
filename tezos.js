const { TezosToolkit } = require('@taquito/taquito');
const { Tzip16Module, tzip16 } = require('@taquito/tzip16');
const { Tzip12Module, tzip12 } = require('@taquito/tzip12');


const TEZOS_NODE_URI = process.env.TEZOS_NODE_URI || "https://mainnet.api.tez.ie";
// const TEZOS_NODE_URI = process.env.TEZOS_NODE_URI || "https://granadanet.smartpy.io";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const Tezos = new TezosToolkit(TEZOS_NODE_URI);
Tezos.addExtension(new Tzip16Module());
Tezos.addExtension(new Tzip12Module());

function hex2utf8(hexx) {
  const buff = Buffer.from(hexx, 'hex');
  const utf8 = buff.toString('utf-8');
  return utf8;
}
const contractPromise = Tezos.contract.at(CONTRACT_ADDRESS, tzip16);

const getHash = async (id) => {
  const storage = await (await contractPromise).storage();
  return await storage.hashes.get(id);
};

const getScript = async () => {
  const storage = await (await contractPromise).storage();
  return storage.script;
};

const getTotalNumber = async () => {
  const storage = await (await contractPromise).storage();
  return storage.all_tokens.toNumber();
};

const getOwners = async () => {
  const storage = await (await contractPromise).storage();
  const n = storage.all_tokens.toNumber();
  const allTokenIds = Array(n).fill(0).map((_, i) => i);
  const ledger = new Map([
    ...(await storage.ledger.getMultipleValues(allTokenIds)).entries(),
  ]);

  const owners = {};
  for (const [id, add] of ledger.entries()) {
    if (!owners[add]) owners[add] = [];
    owners[add].push(id);
  }
  return owners;
};

setTimeout(getOwners, 2000)

module.exports = { getHash, getScript, getOwners, getTotalNumber };
