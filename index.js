const express = require('express');
require('express-async-errors');
const compression = require('compression');
const cors = require('cors');

const router = require('./api');

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


app.use(router);

app.listen(port, () => {
  console.log(`Maker listening on port ${port}`);
});
