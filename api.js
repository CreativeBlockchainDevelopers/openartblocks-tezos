const { parse } = require('./parse_script');
const { getStaticImagePath } = require('./render');
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

function injectHTML(script, hash, html) {
  return html.replace('{{INJECT_SCRIPT_HERE}}', script).replace('{{INJECT_HASH_HERE}}', hash);
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
  };
}
setTimeout(refreshInfos, 5000);

const TIMEOUT = 15 * 60 * 1000;
async function refreshIfNeeded() {
  if (!infos || new Date() - infos.lastUpdated > TIMEOUT) await refreshInfos();
}

async function getScript() {
  await refreshIfNeeded();
  return infos.string;
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

const getMetadata = async (req, res) => {

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenHash = await getTokenHash(id);
  if (!tokenHash) return res.sendStatus(404);

  const attributes = traits(tokenHash)
  // CHECK OPENSEA METADATA STANDARD DOCUMENTATION https://docs.opensea.io/docs/metadata-standards
  let metadata = {
    name: `MyToken #${id}`,
    description: 'My Token description',
    tokenID: id,
    token_hash: tokenHash,
    image: `${HOST}/${id}`,
    animation_url: `${HOST}/live/${id}`,
    attributes,
  };

  res.json(metadata);
}

const getLive = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenHash = await getTokenHash(id);
  if (!tokenHash) return res.sendStatus(404);

  const script = await getScript();
  const html = injectHTML(script, tokenHash, infos.html);

  return res.setHeader('Content-type', 'text/html').send(html);
}

const getImage = async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.sendStatus(404);

  const tokenHash = await getTokenHash(id);
  if (!tokenHash) return res.sendStatus(404);

  const count = await getCount();
  if (count == undefined) return res.sendStatus(404);

  const script = await getScript();
  const path = await getStaticImagePath(script, tokenHash, count);

  return res.sendFile(path, { root: __dirname });
}

module.exports = { getMetadata, getLive, getImage };