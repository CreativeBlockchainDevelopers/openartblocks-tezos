const { createClient } = require('redis');

const client = (async () => {
  const client = createClient({ url: process.env.REDISCLOUD_URL, no_ready_check: true });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  return client;
})();

const metadataKey = (collectionId, tokenId) => `metadata_${collectionId}_${tokenId}`;
const tokenHashKey = (collectionId, tokenId) => `tokenHash_${collectionId}_${tokenId}`;

const getMetadata = async (collectionId, tokenId) => {
  const key = metadataKey(collectionId, tokenId);
  return JSON.parse(await (await client).get(key));
};

const setMetadata = async (collectionId, tokenId, metadata) => {
  const key = metadataKey(collectionId, tokenId);
  await (await client).set(key, JSON.stringify(metadata));
};

const getTokenHash = async (collectionId, tokenId) => {
  const key = tokenHashKey(collectionId, tokenId);
  return (await client).get(key);
};

const setTokenHash = async (collectionId, tokenId, tokenHash) => {
  const key = tokenHashKey(collectionId, tokenId);
  await (await client).set(key, tokenHash);
};


module.exports = { getMetadata, setMetadata, getTokenHash, setTokenHash };