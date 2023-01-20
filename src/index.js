'use strict'
const GameClient = require('./gameClient')
const GithubClient = require('./githubClient')
const UpdateGitHubFiles = require('./updateGitHubFiles')
const SYNC_INTERVAL = +(process.env.SYNC_INTERVAL || 5)
let gameVersions = {gameVersion: '', localeVersion: ''}
const GetCurrentFileVersions = async()=>{
  try{
    let data = await GithubClient.getFile('versions.json')
    if(data?.gameVersion && data?.localeVersion){
      console.log('Current gameVersion on github '+data.gameVersion)
      console.log('Current localeVersion on github '+data.localeVersion)
      gameVersions = data
    }
    CheckAPIReady()
  }catch(e){
    console.error(e);
  }
}
const CheckAPIReady = async()=>{
  try{
    const metaData = await GameClient.getMetaData()
    if(metaData?.latestGamedataVersion){
      console.log('SWGOH API is ready ...')
      StartSync()
    }else{
      console.log('SWGOH API is not ready. Will try again in 5 seconds ...')
      setTimeout(CheckAPIReady, 5 * 1000)
    }
  }catch(e){
    console.error(e);
    setTimeout(CheckAPIReady, 5 * 1000)
  }
}
const StartSync = async()=>{
  try{
    await CheckVersions()
    setTimeout(StartSync, SYNC_INTERVAL * 60 * 1000)
  }catch(e){
    console.error(e);
    setTimeout(StartSync, 5 * 1000)
  }
}
const CheckVersions = async()=>{
  try{
    const metaData = await GameClient.getMetaData()
    if(metaData?.latestGamedataVersion && metaData?.latestLocalizationBundleVersion){
      if(metaData.latestGamedataVersion !== gameVersions.gameVersion || metaData?.latestLocalizationBundleVersion !== gameVersions.localeVersion){
        let tempObj = await UpdateGitHubFiles(metaData.latestGamedataVersion, metaData.latestLocalizationBundleVersion, JSON.parse(JSON.stringify(gameVersions)))
        if(tempObj?.gameVersion && gameVersions.localeVersion) gameVersions = tempObj
      }
    }
  }catch(e){
    console.error(e);
  }
}
GetCurrentFileVersions()
