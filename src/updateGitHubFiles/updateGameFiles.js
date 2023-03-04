'use strict'
const GameClient = require('../gameClient')
const GithubClient = require('../githubClient')
const fs = require('fs')
const path = require('path')
const DATA_DIR = path.join(path.dirname(__dirname), 'data')
const gameDataFilesNeeded = ['equipment', 'relicTierDefinition', 'skill', 'statModSet', 'statProgression', 'table', 'units', 'xpTable']
const SaveFile2GitHub = async(data, fileName, commitMsg, sha)=>{
  try{
    let data64 = Buffer.from(JSON.stringify(data)).toString('base64')
    if(data64) return await GithubClient.pushFile(data64, fileName, commitMsg, sha)
  }catch(e){
    console.error(e);
  }
}
const SaveFile2Dir = async(data, fileName)=>{
  try{
    await fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(data))
  }catch(e){
    console.error(e);
  }
}
module.exports = async(gameVersion, versionObj = {}, files)=>{
  try{
    console.log('Uploading game files for game version '+gameVersion+' to github ...')
    const tempVersion = JSON.parse(JSON.stringify(versionObj))
    let res = false, uploadCount = 0, fileCount = 0, commitMsg = 'update to '+gameVersion, fileNames = []
    const gameEnums = await GameClient.getEnums()
    if(gameEnums && gameEnums['GameDataSegment']){
      fileCount++;
      if(tempVersion['enums.json'] !== gameVersion){
        //let tempObj = {content: {sha: 'ldjfksdjl'}}
        let tempObj = await SaveFile2GitHub({version: gameVersion, data: gameEnums}, 'enums.json', commitMsg, files?.find(x=>x.name === 'enums.json')?.sha)
        if(tempObj?.content?.sha){
          uploadCount++
          tempVersion['enums.json'] = gameVersion;
        }else{
          if(!tempVersion['enums.json']) tempVersion['enums.json'] = 'failed'
          console.log('Error uploading enums.json to github ...')
        }
      }
      for(let i in gameEnums['GameDataSegment']){
        let dataFiles = await GameClient.getGameData(gameVersion, true, gameEnums['GameDataSegment'][i])
        if(dataFiles){
          for(let j in dataFiles){
            if(dataFiles[j] && dataFiles[j].length > 0 && fileNames.filter(x=>x === j).length === 0){
              fileNames.push(j)
              if(gameDataFilesNeeded.filter(x=>x === j).length > 0) await SaveFile2Dir({version: gameVersion, data: dataFiles[j]}, j+'.json', gameVersion)
              if(j === 'units'){
                fileCount++
                if(tempVersion['units.json'] !== gameVersion){
                  let units1 = await SaveFile2GitHub({version: gameVersion, data: dataFiles[j].filter(x=>x.obtainable === true && x.obtainableTime === "0")}, 'units.json', commitMsg, files?.find(x=>x.name === 'units.json')?.sha)
                  if(units1?.content?.sha){
                    tempVersion['units.json'] = gameVersion;
                    uploadCount++;
                  }else{
                    if(!tempVersion['units.json']) tempVersion['units.json'] = 'failed'
                    console.error('error uploading units.json to github ...')
                  }
                }
                fileCount++
                if(tempVersion['units_pve.json'] !== gameVersion){
                  let units2 = await SaveFile2GitHub({version: gameVersion, data: dataFiles[j].filter(x=>x.obtainable !== true || x.obtainableTime !== "0")}, 'units_pve.json', commitMsg, files?.find(x=>x.name === 'units_pve.json')?.sha)
                  if(units2?.content?.sha){
                    tempVersion['units_pve.json'] = gameVersion;
                    uploadCount++;
                  }else{
                    if(!tempVersion['units_pve.json']) tempVersion['units_pve.json'] = 'failed'
                    console.error('error uploading units_pve.json to github ...')
                  }
                }


              }else{
                fileCount++;
                if(tempVersion[j+'.json'] !== gameVersion){
                  //let obj = {content: {sha: 'ldjfksdjl'}}
                  let obj = await SaveFile2GitHub({version: gameVersion, data: dataFiles[j]}, j+'.json', commitMsg, files?.find(x=>x.name === j+'.json')?.sha)
                  if(obj?.content?.sha){
                    tempVersion[j+'.json'] = gameVersion;
                    uploadCount++;
                  }else{
                    if(!tempVersion[j+'.json']) tempVersion[j+'.json'] = 'failed'
                    console.error('error uploading '+j+'.json to github ...')
                  }
                }
              }
            }
          }
        }
        dataFiles = null
      }
      console.log('Uploaded '+uploadCount+'/'+fileCount+' gameData files github ...')
    }
    return JSON.parse(JSON.stringify(tempVersion))
    
  }catch(e){
    console.error(e);
  }
}
