const express = require('express');
const { getMetadata, getMetadataStats, getLive, getImage, getOwnedIds, getThumbnail } = require('./api');
const compression = require('compression');
const cors = require('cors');

// initialize express app
const app = express();
const port = process.env.PORT || 3333;

app.use(cors());

// configure middlewares
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const publicAdminRoot = '../react-app/build';
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: publicAdminRoot });
});
app.use(express.static(publicAdminRoot));


app.get('/owned/:address', getOwnedIds);
app.get('/api/:id', getMetadata);
app.get('/stats/:id', getMetadataStats);
app.get('/live/:id', getLive);
app.get('/static/:id', getImage);
app.get('/thumbnail/:id', getThumbnail);

app.listen(port, () => {
  console.log(`Maker listening on port ${port}`);
});
