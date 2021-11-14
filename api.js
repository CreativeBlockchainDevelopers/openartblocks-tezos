const { parse } = require('./parse_script');
const { getStaticImagePath, getThumbnailPath, getMetadata: getGeneratedMetadata, inject } = require('./render');
const { readFileSync } = require('fs');
const provider = require('./tezos');
const { Mutex } = require("async-mutex");
const router = require("express").Router();

const HOST = process.env.HOST ?? `http://localhost:${process.env.PORT || 3333}`;

function traits(hash) {
  return [
    // generate metadata here
    {
      trait_type: 'Background',
      value: 'gray',
    },
  ];
}

// TODO manage multiple script types (contract.scriptType)
const HTML_p5 = readFileSync('templates/p5.html').toString();
const HTML_svg = readFileSync('templates/svg.html').toString();
const HTML = [HTML_p5, HTML_svg];

function injectHTML({ script }, info, metadata, html) {
  const map = {
    script,
    info: JSON.stringify(info),
    title: metadata.name,
    description: metadata.description,
    url: metadata.externalUri,
    image: metadata.thumbnailUri,
  };
  return inject(html, map);
}

let infos = null;

async function refreshInfos() {
  const res = await provider.getScript();
  const js = await parse(res.slice(1));
  infos = {
    count: 100,// TODO
    string: js,
    html: HTML[Number(res[0])] ?? null,
    lastUpdated: new Date(),
    scriptType: Number(res[0]),
    tokenCount: await provider.getTotalNumber(),
  };
}
setTimeout(refreshInfos, 5000);

async function initMetadataStats() {
  const nTokens = await provider.getTotalNumber();

  const allStats = await updateMetadataStats(new Map(), nTokens - 1);

  return allStats;
}

const mutex = new Mutex();
let biggestStop = -1;

async function updateMetadataStats(allStats, stop) {
  if (stop <= biggestStop) {
    return;
  }
  biggestStop = stop;

  const release = await mutex.acquire();
  try {
    if (stop <= statsHighestKnownToken) {
      release();
      return;
    }
    const start = statsHighestKnownToken === null ? 0 : statsHighestKnownToken + 1;

    const metadata = [];
    const batchSize = 5;
    for (let i = start; i <= stop; i += batchSize) {
      const metadataPromise = [];
      for (let j = i; j < i + batchSize && j <= stop; j++)
        metadataPromise.push(generateMetadata(j));

      metadata.push(...(await Promise.all(metadataPromise)));
    }

    metadata.forEach(metadata => {
      metadata.attributes.forEach(({ name, value }) => {
        if (!allStats.has(name)) allStats.set(name, new Map());
        if (!allStats.get(name).has(value)) allStats.get(name).set(value, 0);
        allStats.get(name).set(value, allStats.get(name).get(value) + 1);
      });
    });

    statsHighestKnownToken = stop;

    return allStats;
  } finally {
    release();
  }
}

setInterval(async () => {
  const ownersPromise = provider.getOwners();
  await ownersPromise;
  owners = ownersPromise;
}, 60 * 1000);

const TIMEOUT = 15 * 60 * 1000;
async function refreshIfNeeded() {
  if (!infos || new Date() - infos.lastUpdated > TIMEOUT) await refreshInfos();
}

async function getScript() {
  await refreshIfNeeded();
  return { script: infos.string, type: infos.scriptType };
}

async function getCount() {
  await refreshIfNeeded();
  return infos.count;
}

async function getTokenCount() {
  await refreshIfNeeded();
  return infos.tokenCount;
}

async function getTokenHash(id) {

  if (tokenHashes[id] === undefined) {

    const totalSupply = await provider.getTotalNumber();

    if (id >= totalSupply || id < 0) return null;

    tokenHashes[id] = await provider.getHash(id);
  }
  return tokenHashes[id];

}


const tokenHashes = {};

async function getTokenInfo(id) {
  const tokenHash = await getTokenHash(id);
  if (!tokenHash) return null;
  return {
    tokenHash,
    tokenId: id,
  };
}

const generateMetadata = async (id) => {
  if (isNaN(id)) throw 404;

  const tokenInfo = await getTokenInfo(id);
  if (!tokenInfo) throw 404;

  const count = await getCount();
  if (count == undefined) throw 404;

  const script = await getScript();
  const generatedMetadata = await getGeneratedMetadata(script, tokenInfo, count);

  // CHECK TZIP-21 METADATA STANDARD SPECS https://gitlab.com/tezos/tzip/-/blob/master/proposals/tzip-21/tzip-21.md
  let metadata = {
    decimals: 0,
    // minter: 'would require an index',
    artifactUri: `${HOST}/live/${id}`,
    displayUri: `${HOST}/static/${id}`,
    thumbnailUri: `${HOST}/thumbnail/${id}`,
    isBooleanAmount: true,

    // not standard
    tokenId: tokenInfo.tokenId,
    tokenHash: tokenInfo.tokenHash,

    ...generatedMetadata,
  };
  return metadata;
}

const getMetadata = async (req, res) => {
  const { id } = req.body;
  try {
    const metadata = await generateMetadata(id);

    res.json(metadata);

    if (statsHighestKnownToken !== null && id > statsHighestKnownToken) {
      stats = updateMetadataStats((await stats), id);
    }
  } catch (status) {
    return res.sendStatus(status);
  }
}

const getMetadataStats = async (req, res) => {
  const { id } = req.body;
  try {
    const metadata = await generateMetadata(id);

    const allStats = await Promise.race([
      stats,
      new Promise((_, reject) => setTimeout(() => reject(408), 5000))
    ]);

    const statsMetadata = {};

    metadata.attributes.forEach(({ name, value }) => {
      const freq = (allStats.get(name).get(value) / (statsHighestKnownToken + 1)) * 100;
      statsMetadata[name] = freq !== 0 && freq !== 100 ? freq.toFixed(2) : freq.toString();
    });

    res.json(statsMetadata);

    if (statsHighestKnownToken !== null && id > statsHighestKnownToken) {
      stats = updateMetadataStats(await stats, id);
    }
  } catch (status) {
    return res.sendStatus(status);
  }
}

const getLive = async (req, res) => {
  const { tokenInfo } = req.body;

  const script = await getScript();
  const metadata = await generateMetadata(id);
  const html = injectHTML(script, tokenInfo, metadata, infos.html);

  return res.setHeader('Content-type', 'text/html').send(html);
}

const getImage = async (req, res) => {
  const { tokenInfo } = req.body;

  const count = await getCount();
  if (count == undefined) return res.sendStatus(404);

  const script = await getScript();
  const path = await getStaticImagePath(script, tokenInfo, count);

  return res.sendFile(path, { root: __dirname });
}

const getThumbnail = async (req, res) => {
  const { tokenInfo } = req.body;

  const count = await getCount();
  if (count == undefined) return res.sendStatus(404);

  const script = await getScript();
  const path = await getThumbnailPath(script, tokenInfo, count);

  return res.sendFile(path, { root: __dirname });
}

const getOwnedIds = async (req, res) => {
  const address = req.params.address;

  const ids = (await owners)[address];
  return res.json(ids ?? []);
}

let owners = provider.getOwners();
let stats = initMetadataStats();
let statsHighestKnownToken = null;

const idMiddleware = async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  req.body.id = id;
  return next();
}
const tokenInfoMiddleware = async (req, res, next) => {
  const { id } = req.body;

  const tokenInfo = await getTokenInfo(id);
  if (!tokenInfo) return res.sendStatus(404);

  req.body.tokenInfo = tokenInfo;
  return next();
}

router.get('/owned/:address', getOwnedIds);
// needs id
router.get('/api/:id', idMiddleware, getMetadata);
router.get('/stats/:id', idMiddleware, getMetadataStats);
// needs tokenInfo
router.get('/live/:id', idMiddleware, tokenInfoMiddleware, getLive);
router.get('/static/:id', idMiddleware, tokenInfoMiddleware, getImage);
router.get('/thumbnail/:id', idMiddleware, tokenInfoMiddleware, getThumbnail);

module.exports = router;
