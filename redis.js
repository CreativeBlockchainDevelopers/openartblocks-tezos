const { createClient } = require('redis');

const client = (async () => {
  const client = createClient({ url: process.env.REDISCLOUD_URL, no_ready_check: true });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  return client;
})();

const getMetadata = async (collectionId, tokenId) => {
  const key = `metadata_${collectionId}_${tokenId}`;
  return JSON.parse(await (await client).get(key));
};

const setMetadata = async (collectionId, tokenId, metadata) => {
  const key = `metadata_${collectionId}_${tokenId}`;
  await (await client).set(key, JSON.stringify(metadata));
};

const getTokenHash = async (collectionId, tokenId) => {
  return await getMetadata(collectionId, tokenId).tokenHash;
};


module.exports = { getMetadata, setMetadata, getTokenHash };