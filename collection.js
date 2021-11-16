const { Mutex } = require("async-mutex");
const { readFileSync } = require('fs');

const { parse } = require('./parse_script');
const { TezosProvider } = require('./tezos');
const { getStaticImagePath, getThumbnailPath, getMetadata: getGeneratedMetadata } = require('./render');
const { injectHTML } = require('./templating');

const TIMEOUT = 15 * 60 * 1000;
const HOST = process.env.HOST ?? `http://localhost:${process.env.PORT || 3333}`;

const HTML_p5 = readFileSync('templates/p5.html').toString();
const HTML_svg = readFileSync('templates/svg.html').toString();
const HTML = [HTML_p5, HTML_svg];

class Collection {
  constructor(id, provider) {
    this.id = id;
    this.provider = provider;
    this.tokenHashes = {};
    this.infos = null;
    this.mutex = new Mutex();
    this.biggestStop = -1;
    this.statsHighestKnownToken = null;

    this.owners = this.provider.getOwners();
    this.stats = this.initMetadataStats();

    setInterval(async () => {
      const ownersPromise = this.provider.getOwners();
      await ownersPromise;
      this.owners = ownersPromise;
    }, 60 * 1000);
  }

  async tokenExists(id) {
    return (id >= 0 && await this.getTokenCount() > id) || !!(await this.getTokenHash(id))
  }

  async getOwnedTokenIds(address) {
    return (await this.owners)[address] ?? [];
  }

  async getStatsFromId(id) {
    const metadata = await this.generateMetadata(id);
    const allStats = await this.stats;

    const statsMetadata = {};

    metadata.attributes.forEach(({ name, value }) => {
      const freq = (allStats.get(name).get(value) / (this.statsHighestKnownToken + 1)) * 100;
      statsMetadata[name] = freq !== 0 && freq !== 100 ? freq.toFixed(2) : freq.toString();
    });
    return statsMetadata;
  }

  async updateMetadataStats(stop, stats) {
    if (stop <= this.biggestStop) {
      return;
    }
    this.biggestStop = stop;

    const release = await this.mutex.acquire();
    if (stop <= this.statsHighestKnownToken) {
      release();
      return;
    }
    try {
      const start = this.statsHighestKnownToken === null ? 0 : this.statsHighestKnownToken + 1;

      const metadata = [];
      const batchSize = 5;
      for (let i = start; i <= stop; i += batchSize) {
        const metadataPromise = [];
        // TODO real redis batching with MGET
        for (let j = i; j < i + batchSize && j <= stop; j++)
          metadataPromise.push(this.generateMetadata(j));

        metadata.push(...(await Promise.all(metadataPromise)));
      }

      const allStats = await (stats ?? new Map());

      metadata.forEach(metadata => {
        metadata.attributes.forEach(({ name, value }) => {
          if (!allStats.has(name)) allStats.set(name, new Map());
          if (!allStats.get(name).has(value)) allStats.get(name).set(value, 0);
          allStats.get(name).set(value, allStats.get(name).get(value) + 1);
        });
      });

      this.statsHighestKnownToken = stop;

      this.stats = new Promise(resolve => resolve(allStats));
      return allStats;
    } finally {
      release();
    }
  }

  async initMetadataStats() {
    const nTokens = await this.provider.getTotalNumber();

    const allStats = await this.updateMetadataStats(nTokens - 1, null);

    return allStats;
  }

  async getTokenHash(id) {
    if (this.tokenHashes[id] === undefined) {
      const totalSupply = await this.provider.getTotalNumber();
      if (id >= totalSupply || id < 0) return null;
      this.tokenHashes[id] = await this.provider.getHash(id);
    }
    return this.tokenHashes[id];
  }

  async getTokenInfo(id) {
    const tokenHash = await this.getTokenHash(id);
    if (!tokenHash) return null;
    return {
      tokenHash,
      tokenId: id,
      collectionId: this.id,
    };
  }

  async generateMetadata(id) {
    if (isNaN(id)) throw 404;

    const tokenInfo = await this.getTokenInfo(id);
    if (!tokenInfo) throw 404;

    const count = await this.getCount();
    if (count == undefined) throw 404;

    const script = await this.getScript();
    const generatedMetadata = await getGeneratedMetadata(script, tokenInfo, count);

    // CHECK TZIP-21 METADATA STANDARD SPECS https://gitlab.com/tezos/tzip/-/blob/master/proposals/tzip-21/tzip-21.md
    let metadata = {
      decimals: 0,
      // minter: 'would require an index',
      artifactUri: `${HOST}/${this.id}/live/${id}`,
      displayUri: `${HOST}/${this.id}/static/${id}`,
      thumbnailUri: `${HOST}/${this.id}/thumbnail/${id}`,
      isBooleanAmount: true,

      // not standard
      tokenId: tokenInfo.tokenId,
      tokenHash: tokenInfo.tokenHash,

      ...generatedMetadata,
    };
    return metadata;
  }

  async refreshInfos() {
    const res = await this.provider.getScript();
    const js = await parse(res.slice(1));
    this.infos = {
      count: 100,// TODO
      string: js,
      html: HTML[Number(res[0])] ?? null,
      lastUpdated: new Date(),
      scriptType: Number(res[0]),
      tokenCount: await this.provider.getTotalNumber(),
    };
  }

  async refreshIfNeeded() {
    if (!this.infos || new Date() - this.infos.lastUpdated > TIMEOUT) await this.refreshInfos();
  }

  async getScript() {
    await this.refreshIfNeeded();
    return { script: this.infos.string, type: this.infos.scriptType };
  }

  async getHtml() {
    await this.refreshIfNeeded();
    return this.infos.html;
  }

  async getCount() {
    await this.refreshIfNeeded();
    return this.infos.count;
  }

  async getTokenCount() {
    await this.refreshIfNeeded();
    return this.infos.tokenCount;
  }

  async getThumbnailPath(tokenId) {
    const tokenInfo = await this.getTokenInfo(tokenId);
    const count = await this.getCount();
    const script = await this.getScript();
    return await getThumbnailPath(script, tokenInfo, count);
  }

  async getStaticImagePath(tokenId) {
    const tokenInfo = await this.getTokenInfo(tokenId);
    const count = await this.getCount();
    const script = await this.getScript();
    return await getStaticImagePath(script, tokenInfo, count);
  }

  async getLiveHTML(tokenId) {
    const tokenInfo = await this.getTokenInfo(tokenId);
    const script = await this.getScript();
    const metadata = await this.generateMetadata(tokenId);
    const baseHtml = await this.getHtml();

    return injectHTML(script, tokenInfo, metadata, baseHtml);
  }
}

const collections = [new Collection(0, new TezosProvider(process.env.CONTRACT_ADDRESS, process.env.TEZOS_NODE_URI))];

module.exports = { collections };