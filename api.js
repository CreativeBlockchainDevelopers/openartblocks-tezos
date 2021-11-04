const { parse } = require('./parse_script');
const { getStaticImagePath, getThumbnailPath, getMetadata: getGeneratedMetadata, inject } = require('./render');
const { readFileSync } = require('fs');
const provider = require('./tezos');

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

function injectHTML({script}, info, metadata, html) {
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
  };
}
setTimeout(refreshInfos, 5000);

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
  return {
    tokenHash: await getTokenHash(id),
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
    externalUri: `${HOST}/${id}`,//TODO
    isBooleanAmount: true,

    // not standard
    tokenId: tokenInfo.tokenId,
    tokenHash: tokenInfo.tokenHash,

    ...generatedMetadata,
  };
  return metadata;
}

const getMetadata = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const metadata = await generateMetadata(id);
    return res.json(metadata);
  } catch (status) {
    return res.sendStatus(status);
  }
}

const getLive = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenInfo = await getTokenInfo(id);
  if (!tokenInfo) return res.sendStatus(404);

  const script = await getScript();
  const metadata = await generateMetadata(id);
  const html = injectHTML(script, tokenInfo, metadata, infos.html);

  return res.setHeader('Content-type', 'text/html').send(html);
}

const getImage = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenInfo = await getTokenInfo(id);
  if (!tokenInfo) return res.sendStatus(404);

  const count = await getCount();
  if (count == undefined) return res.sendStatus(404);

  const script = await getScript();
  const path = await getStaticImagePath(script, tokenInfo, count);

  return res.sendFile(path, { root: __dirname });
}

const getThumbnail = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenInfo = await getTokenInfo(id);
  if (!tokenInfo) return res.sendStatus(404);

  const count = await getCount();
  if (count == undefined) return res.sendStatus(404);

  const script = await getScript();
  const path = await getThumbnailPath(script, tokenInfo, count);

  return res.sendFile(path, { root: __dirname });
}

module.exports = { getMetadata, getLive, getImage, getThumbnail };