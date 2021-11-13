import { createClient } from 'redis';
import { getMetadata } from './render';

const client = (async () => {
  const client = createClient(process.env.REDISCLOUD_URL, { no_ready_check: true });
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  return client;
})();

const getMetadata = async (tokenHash) => {
  const key = `metadata_${tokenHash}`;
  return (await client).get(key);
};

const setMetadata = async (tokenHash, metadata) => {
  const key = `metadata_${tokenHash}`;
  await (await client).set(key, metadata);
};

module.exports = { getMetadata, setMetadata };