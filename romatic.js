#!/usr/bin/env node
const ArgumentParser = require('argparse').ArgumentParser;
const fs = require('fs-extra');
const path = require('path');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const xpath = require('xml2js-xpath');
const manifest = require('./package.json');

const parser = new ArgumentParser({
  version: manifest.version,
  description: manifest.description,
});
parser.addArgument('dat', { help: 'Path to a DAT file.' });
parser.addArgument('roms', { help: 'Path to ROM directory.' });
const args = parser.parseArgs();
const xml = fs.readFileSync(args.dat);
xml2js.parseString(xml, async (errDat, dat) => {
  if (errDat) throw errDat;
  await fs.readdir(args.roms).then(roms => Promise.all(roms.map(async (f) => {
    const zip = await fs.readFile(path.resolve(args.roms, f)).then(z => JSZip.loadAsync(z));
    Object.values(zip.files).forEach((rom) => {
      // eslint-disable-next-line
      const crc = (rom._data.crc32 >>> 0).toString(16).toUpperCase().padStart(8, '0');
      // eslint-disable-next-line
      const size = rom._data.uncompressedSize;
      const romData = xpath.evalFirst(dat, `//rom[@crc='${crc}']`);
      if (!romData) { console.warn(`UNKNOWN: "${f}/${rom.name}" ${crc}`); return; }
      if (parseInt(romData.$.size, 10) !== size) console.warn(`WRONG SIZE: "${f}/${rom.name}" ${size}`);
      if (romData.found) console.warn('DUPLICATE:', rom.name);
      romData.found = true;
    });
  })));
  xpath.find(dat, '//rom').filter(r => !r.found).forEach((rom) => {
    console.warn('MISSING:', rom.$.name);
  });
});
