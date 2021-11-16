const { TezosToolkit } = require('@taquito/taquito');
const { Tzip16Module, tzip16 } = require('@taquito/tzip16');
const { getTokenHash, setTokenHash } = require('./redis');

const tezosInstances = new Map();

function getTezosInstance(nodeUri) {
  let tezos = tezosInstances.get(nodeUri);
  if (tezos === undefined) {
    tezos = new TezosToolkit(nodeUri);
    tezos.addExtension(new Tzip16Module());
    tezosInstances.set(nodeUri, tezos);
  }
  return tezos;
}

class TezosProvider {
  constructor(contractAddress, nodeUri = "https://mainnet.api.tez.ie") {
    this.contractAddress = contractAddress;
    this.contract = getTezosInstance(nodeUri).contract.at(contractAddress, tzip16);
    this.contract.then(() => this.getOwners());
    this.hashes = new Map();
    this.hashes.set(0, new Map());
  }

  async getHash(id) {
    if (this.hashes.get(0).has(id)) {
      return this.hashes.get(0).get(id);
    }

    let tokenHash;
    tokenHash = await getTokenHash(0, id);
    if (tokenHash) return tokenHash;

    const storage = await (await this.contract).storage();
    tokenHash = await storage.hashes.get(id);
    this.hashes.get(0).set(id, tokenHash);
    setTokenHash(0, id, tokenHash);

    return tokenHash;
  }

  async getScript() {
    const storage = await (await this.contract).storage();
    return storage.script;
  }

  async getTotalNumber() {
    const storage = await (await this.contract).storage();
    return storage.all_tokens.toNumber();
  }

  async getOwners() {
    const storage = await (await this.contract).storage();
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
  }
}

module.exports = { TezosProvider };
