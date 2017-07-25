#!/usr/bin/env node
const ArgumentParser = require('argparse').ArgumentParser;
const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const xpath = require('xml2js-xpath');
const manifest = require('./package.json');

async function processROM(rom, dat) {
  // eslint-disable-next-line
  const crc = (rom._data.crc32 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  // eslint-disable-next-line
  const size = rom._data.uncompressedSize;
  const info = xpath.evalFirst(dat, `//rom[@crc='${crc}']`);
  if (!info || parseInt(info.$.size, 10) !== size) {
    console.log(`UNKNOWN: "${rom.name}" ${crc}`);
    return null;
  }
  if (info.found) {
    console.log(`DUPLICATE: ${info.$.name}`);
    return null;
  }
  info.found = true;
  if (rom.name !== info.$.name) {
    console.log(`WRONG NAME: ${rom.name} != ${info.$.name}`);
  }
  const basename = path.basename(info.$.name, path.extname(info.$.name));
  return rom.async('nodebuffer').then(data =>
    new JSZip().file(info.$.name, data).generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    }).then(res => fs.writeFile(path.resolve('out', `${basename}.zip`), res)));
}

const parser = new ArgumentParser({
  version: manifest.version,
  description: manifest.description,
});
parser.addArgument('dat', { help: 'Path to a DAT file.' });
parser.addArgument('roms', { help: 'Path to ROM directory.' });
const args = parser.parseArgs();
xml2js.parseString(fs.readFileSync(args.dat), async (errDat, dat) => {
  if (errDat) throw errDat;
  await fs.readdir(args.roms).then(roms =>
    roms.reduce((promise, file) =>
      promise.then(() =>
        fs.readFile(path.resolve(args.roms, file)).then(f =>
          JSZip.loadAsync(f).then(z =>
            Promise.all(Object.values(z.files).map(rom =>
              processROM(rom, dat)))))), Promise.resolve()));
  xpath.find(dat, '//rom').filter(r => !r.found).forEach((rom) => {
    console.log('MISSING:', rom.$.name);
  });
});
