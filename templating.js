const inject = (str, map) => Object.entries(map)
.reduce((acc, [k, v]) => acc.replaceAll(`\'{{INJECT_${k.toUpperCase()}_HERE}}\'`, v), str);

const injectHTML = ({ script }, info, metadata, html) => {
  const map = {
    script,
    info: JSON.stringify(info),
    title: metadata.name,
    description: metadata.description,
    url: metadata.externalUri,
    image: metadata.thumbnailUri,
  };
  return inject(html, map);
};

module.exports = { inject, injectHTML };