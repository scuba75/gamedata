'use strict'
const fetch = require('node-fetch')
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO_URL = process.env.GITHUB_REPO_URL
const USER_NAME = process.env.USER_NAME
const USER_EMAIL = process.env.USER_EMAIL
const Cmds = {}
Cmds.pushFile = async(data, fileName, commitMsg, sha, path)=>{
  try{
    if(!GITHUB_TOKEN || !GITHUB_REPO_URL) return
    const headers = {
      Authorization: "Bearer "+GITHUB_TOKEN,
      'Content-Type': 'application/json'
    }
    const body = {
      committer: {name: USER_NAME, email: USER_EMAIL},
      message: commitMsg,
      content: data,
      sha: sha
    }
    const obj = await fetch(GITHUB_REPO_URL+'/'+fileName, {
      method: 'PUT',
      headers: headers,
      compress: true,
      body: JSON.stringify(body)
    })
    const resHeader = obj?.headers.get('content-type')
    if(resHeader?.includes('application/json')) return await obj.json()
  }catch(e){
    console.error(e);
  }
}
Cmds.getRepoFiles = async()=>{
  try{
    if(!GITHUB_TOKEN || !GITHUB_REPO_URL) return
    const headers = {
      Authorization: "Bearer "+GITHUB_TOKEN,
      'Content-Type': 'application/json'
    }
    const obj = await fetch(GITHUB_REPO_URL, {
      method: 'GET',
      headers: headers,
      compress: true
    })
    const resHeader = obj?.headers.get('content-type')
    if(resHeader?.includes('application/json')) return await obj.json()
  }catch(e){
    console.error(e);
  }
}
Cmds.getFile = async(fileName, files)=>{
  try{
    let file, data
    if(!GITHUB_REPO_URL || !GITHUB_TOKEN) return
    const headers = {
      Authorization: "Bearer "+GITHUB_TOKEN,
      'Content-Type': 'application/json'
    }
    if(!files) files = await Cmds.getRepoFiles()
    if(files?.length > 0) file = files.find(x=>x.name === fileName)
    if(!file?.download_url) return
    data = await fetch(file.download_url, {
      method: 'GET',
      headers: headers,
      compress: true
    })
    if(data) return await data.json()
  }catch(e){
    console.error(e);
  }
}
module.exports = Cmds
