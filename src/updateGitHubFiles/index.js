'use strict'
const UpdateGameFiles = require('./updateGameFiles')
const BuildGameData = require('./buildGameData')
const UpdateLocalFiles = require('./updateLocaleFiles')
const GithubClient = require('../githubClient')
const SaveFile2GitHub = async(data, fileName, commitMsg, sha)=>{
  try{
    let data64 = Buffer.from(JSON.stringify(data)).toString('base64')
    if(data64) return await GithubClient.pushFile(data64, fileName, commitMsg, sha)
  }catch(e){
    console.error(e);
  }
}
module.exports = async(gameVersion, localeVersion, versionObj = {})=>{
  try{
    let tempVersion = JSON.parse(JSON.stringify(versionObj))
    const files = await GithubClient.getRepoFiles()
    if(!files || files?.message) return
    delete tempVersion.gameVersion
    delete tempVersion.localeVersion
    let gameVersionObj = await UpdateGameFiles(gameVersion, tempVersion, files)
    if(gameVersionObj) tempVersion = {...tempVersion,...gameVersionObj}
    await BuildGameData(gameVersion, tempVersion, files)
    let localeVersionObj = await UpdateLocalFiles(localeVersion, tempVersion, files)
    if(localeVersionObj) tempVersion = {...tempVersion,...localeVersionObj}
    let array = Object.values(tempVersion)
    if(array.filter(x=>x === gameVersion || x === localeVersion).length === array.length && array.length > 0){
      //let tempObj = {content: {sha: 'ldjfksdjl'}}
      tempVersion.gameVersion = gameVersion
      tempVersion.localeVersion = localeVersion
      let tempObj = await SaveFile2GitHub(tempVersion, 'versions.json', 'update to '+gameVersion, files?.find(x=>x.name === 'versions.json')?.sha)
      if(tempObj?.content?.sha){
        console.log('Saved all files to github ...')
      }else{
        tempVersion.gameVersion = versionObj.gameVersion
        tempVersion.localeVersion = versionObj.localeVersion
        console.error('Error saving versions.json to github')
      }
      //console.log(tempVersion)
      return JSON.parse(JSON.stringify(tempVersion))
    }
  }catch(e){
    console.error(e);
  }
}
