'use strict'
const fs = require('fs')
const GameClient = require('../gameClient')
const GithubClient = require('../githubClient')
const JSZip = require('jszip');
const { createInterface } = require('readline');
const { once } = require('events');
const SaveFile2GitHub = async(data, fileName, commitMsg, sha)=>{
  try{
    let data64 = Buffer.from(JSON.stringify(data)).toString('base64')
    if(data64) return await GithubClient.pushFile(data64, fileName, commitMsg, sha)
  }catch(e){
    console.error(e);
  }
}
const processStreamByLine = async (fileStream) => {
  const langMap = {};

  try {
    const rl = createInterface({
      input: fileStream,
      //crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      const result = processLocalizationLine(line);
      if (result) {
        const [key, val] = result;
        langMap[key] = val;
      }
    });

    await once(rl, 'close');
  } catch (err) {
    console.error(err);
  }

  return langMap;
};
const processLocalizationLine = (line) => {
  if (line.startsWith('#')) return;
  let [ key, val ] = line.split(/\|/g).map(s => s.trim());
  if (!key || !val) return;
  val = val.replace(/^\[[0-9A-F]*?\](.*)\s+\(([A-Z]+)\)\[-\]$/, (m,p1,p2) => p1);
  return [key, val];
}
module.exports = async(localeVersion, versionObj = {}, files)=>{
  try{
    console.log('Uploading locale files for version '+localeVersion+' to github ...')
    let tempVersion = JSON.parse(JSON.stringify(versionObj)), fileCount = 0, uploadCount = 0, commitMsg = 'Update to '+localeVersion
    let localeFiles = await GameClient.getLocalizationBundle(localeVersion, false)
    if(localeFiles){
      const zipped = await (new JSZip())
          .loadAsync(Buffer.from(localeFiles.localizationBundle, 'base64'), { base64:true });
        localeFiles = Object.entries(zipped.files);
    }
    for(let [lang, content] of localeFiles){
      fileCount++
      if(tempVersion[lang+'.json'] !== localeVersion){
        const fileStream = content.nodeStream();
        let langMap = await processStreamByLine(fileStream);
        if(langMap){
          //let tempObj = {content: {sha: 'ldjfksdjl'}}
          let tempObj = await SaveFile2GitHub({version: localeVersion, data: langMap}, lang+'.json', commitMsg, files?.find(x=>x.name === lang+'.json')?.sha)
          if(tempObj?.content?.sha){
            tempVersion[lang+'.json'] = localeVersion;
            uploadCount++
          }else{
            if(!tempVersion[lang+'.json']) tempVersion[lang+'.json'] = 'failed'
            console.log('Error uploading '+lang+'.json to github ...')
          }
        }
      }
    }
    console.log('Uploaded '+uploadCount+'/'+fileCount+' locale files github ...')
    return JSON.parse(JSON.stringify(tempVersion))
  }catch(e){
    console.error(e);
  }
}
