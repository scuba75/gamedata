'use strict'
const ComlinkStub = require('@swgoh-utils/comlink');
const client = new ComlinkStub({
  url: process.env.CLIENT_URL, // swgoh-comlink service URL
  compression: true
});
module.exports = client
