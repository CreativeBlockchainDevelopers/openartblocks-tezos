const { Router } = require("express");
const { collections } = require("./collection");

const getMetadata = async (req, res) => {
  const { id, collection } = req.body;

  const metadata = await collection.generateMetadata(id);
  res.json(metadata);

  collection.updateMetadataStats(id);
}

const getMetadataStats = async (req, res) => {
  const { id, collection } = req.body;
  const statsMetadata = await Promise.race([
    collection.getStatsFromId(id),
    new Promise((_, reject) => setTimeout(() => reject(408), 5000))
  ]);
  res.json(statsMetadata);

  collection.updateMetadataStats(id);
}

const getLive = async (req, res) => {
  const { id, collection } = req.body;
  const html = await collection.getLiveHTML(id);

  return res.setHeader('Content-type', 'text/html').send(html);
}

const getImage = async (req, res) => {
  const { id, collection } = req.body;
  const path = await collection.getStaticImagePath(id);

  return res.sendFile(path, { root: __dirname });
}

const getThumbnail = async (req, res) => {
  const { id, collection } = req.body;
  const path = await collection.getThumbnailPath(id);

  return res.sendFile(path, { root: __dirname });
}

const getOwnedIds = async (req, res) => {
  const { collection } = req.body;
  const address = req.params.address;
  const ids = await collection.getOwnedTokenIds(address);

  return res.json(ids);
}

// middlewares

const collectionMiddleware = async (req, res, next) => {
  const colId = parseInt(req.params.collectionId);
  if (isNaN(colId) || !collections[colId]) return res.sendStatus(404);
  req.body.collection = collections[colId];
  return next();
}

const idMiddleware = async (req, res, next) => {
  const { collection } = req.body;
  const id = parseInt(req.params.id);
  if (isNaN(id) || !(await collection.tokenExists(id))) throw 404;

  req.body.id = id;
  return next();
}

const router = Router();

router.get('/owned/:address', getOwnedIds);
// needs id
router.get('/api/:id', idMiddleware, getMetadata);
router.get('/stats/:id', idMiddleware, getMetadataStats);
router.get('/live/:id', idMiddleware, getLive);
router.get('/static/:id', idMiddleware, getImage);
router.get('/thumbnail/:id', idMiddleware, getThumbnail);

const collectionRouter = Router();
collectionRouter.use('/:collectionId', collectionMiddleware, router);

collectionRouter.use(function (err, req, res, next) {
  // Send status if thrown error was one, otherwise 500
  if (typeof err === 'number') return res.sendStatus(err);
  console.error(err);
  return res.sendStatus(500);
});

module.exports = collectionRouter;
