const { TezosToolkit } = require('@taquito/taquito');
const { Tzip16Module, tzip16 } = require('@taquito/tzip16');
const { Tzip12Module, tzip12 } = require('@taquito/tzip12');


//const TEZOS_NODE_URI = process.env.TEZOS_NODE_URI || "https://mainnet.api.tez.ie";
const TEZOS_NODE_URI = process.env.TEZOS_NODE_URI || "https://granadanet.smartpy.io";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const Tezos = new TezosToolkit(TEZOS_NODE_URI);
Tezos.addExtension(new Tzip16Module());
Tezos.addExtension(new Tzip12Module());

function hex2utf8(hexx) {
  const buff = Buffer.from(hexx, 'hex');
  const utf8 = buff.toString('utf-8');
  return utf8;
}
let contract;
Tezos.contract.at(CONTRACT_ADDRESS, tzip16).then(c => contract = c);

const getHash = async (id) => {
  const storage = await contract.storage();
  return await storage.hashes.get(id);
};

const getScript = async () => {
  const storage = await contract.storage();
  return storage.script;
};

const getTotalNumber = async () => {
  const storage = await contract.storage();
  return storage.all_tokens.toNumber();
};

module.exports = { getHash, getScript, getTotalNumber };