'use strict';
// Isolated functional test build only: no external font network and no visual/font delivery claim.
// Next's documented-in-source test hook supplies CSS; no application source is replaced.
module.exports = new Proxy({}, { get: (_target, url) => {
  if (typeof url !== 'string' || !url.startsWith('https://fonts.googleapis.com/css2?family=Geist')) return undefined;
  return '@font-face{font-family:"Geist fixture";src:local("Arial");font-display:swap;}';
} });
