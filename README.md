# Tezos OpenArtBlocks Backend
This project is part of OpenArtBlocks, an open-source self-hosted approach to creating generative art on the Tezos and Ethereum blockchains. It allows any artist to create generative art that is constructed only at the time of minting, thus making the art truly generative.

This is a node Express / Selenium server for generating the art from public blockchain-stored information.
It serves the art and its metadata during the sale, before switching to an IPFS-like network for long-term storage.

## Deploy to heroku
### One-click heroku deploy
Coming soon...

### Manual setup

#### Environment variables
Mandatory:

* `CHROME_BINARY_PATH`: On heroku it should be `/app/.apt/opt/google/chrome/chrome`
* `CHROME_DRIVER_PATH`: On heroku it should be `/app/.chromedriver/bin/chromedriver`
* `CONTRACT_ADDRESS`: The tezos address of your contract
* `TEZOS_NODE_URI`: The address of your node. This will decide what network is used (mainnet/testnets).
If you have a custom node or provider, write its address here.
Otherwise, try the standard nodes, such as `https://granadanet.smartpy.io` for granadanet, `https://mainnet.api.tez.ie` for mainnet...
* `HOST`: The address of your server (`https://XXXX.herokuapp.com`, `http://localhost:3333` ...)

Optional:

* `PORT`: The TCP Port on which to listen. You most likely don't need to set this one.

## How it works
Coming soon...


## Project setup

### Set up the repository
```
npm install
```

### Start the development server
```
npm run start
```

## Questions, suggestions?
For issues with the code, feel free to open a github issue.
For suggestions or troubleshooting, feel free to contact us on our [discord server](https://discord.gg/xsun2M33Jt).

## Related projects
See all related projects on the [OpenArtBlocks](https://github.com/GenArtLabs/OpenArtBlocks) repository.
