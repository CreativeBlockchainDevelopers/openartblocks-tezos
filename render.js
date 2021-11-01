const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { Mutex } = require("async-mutex");
const { readFileSync, promises } = require('fs');
const { writeFile, readFile, access } = promises;

const HTML_p5 = readFileSync('templates/p5_render.html').toString();

const buildDriver = () => {
  let options = new chrome.Options();

  options.setChromeBinaryPath(process.env.CHROME_BINARY_PATH);
  let serviceBuilder = new chrome.ServiceBuilder(process.env.CHROME_DRIVER_PATH);


  //Don't forget to add these for heroku
  options.headless();
  options.addArguments("--disable-gpu");
  options.addArguments("--no-sandbox");

  let driver = new webdriver.Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setChromeService(serviceBuilder)
    .build();

  return driver;
}

const metadataCache = {};

const driver = buildDriver();
const mutex = new Mutex();

const getData = async (URI) => {
  const release = await mutex.acquire();
  try {
    await driver.get(URI);

    return await driver.executeAsyncScript("wait(arguments[0]);");//arguments[arguments.length - 1]
  } finally {
    release();
  }
}

const render = async (script, tokenInfo, count) => {
  const htmlContent = HTML_p5.replace('{{INJECT_SCRIPT_HERE}}', script).replace('\'{{INJECT_INFO_HERE}}\'', JSON.stringify(tokenInfo)).replace('{{INJECT_COUNT_HERE}}', count);
  await writeFile('/tmp/test.html', htmlContent);

  const [metadata, b64Img, b64Thumb] = await getData("data:text/html;base64," + Buffer.from(htmlContent, 'utf-8').toString('base64'));

  const path = `generated/${tokenInfo.tokenHash}.png`;
  const thumbnailPath = `generated/thumb_${tokenInfo.tokenHash}.png`;
  const metadataPath = `generated/${tokenInfo.tokenHash}.json`;
  metadataCache[tokenInfo.tokenHash] = metadata;
  console.log(path);

  await writeFile(path, b64Img, { encoding: 'base64' });
  await writeFile(thumbnailPath, b64Thumb, { encoding: 'base64' });
  await writeFile(metadataPath, JSON.stringify(metadata));
}

const getStaticImagePath = async (script, tokenInfo, count) => {
  const path = `generated/${tokenInfo.tokenHash}.png`;
  try {
    await access(path);
  } catch {
    await render(script, tokenInfo, count);
  }
  return path;
}

const getThumbnailPath = async (script, tokenInfo, count) => {
  const path = `generated/thumb_${tokenInfo.tokenHash}.png`;
  try {
    await access(path);
  } catch {
    await render(script, tokenInfo, count);
  }
  return path;
}

const getMetadata = async (script, tokenInfo, count) => {
  const { tokenHash } = tokenInfo;
  if (metadataCache[tokenHash]) return metadataCache[tokenHash];

  const path = `generated/${tokenHash}.json`;
  try {
    await access(path);
  } catch {
    await render(script, tokenInfo, count);
  }
  const rawData = await readFile(path);
  const data = JSON.parse(rawData);
  return data;
}

module.exports = { getStaticImagePath, getThumbnailPath, getMetadata };
