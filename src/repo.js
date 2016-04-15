import git from "nodegit"

import Lock from "./lock"

const CONFIGURATION_REPO = process.env.CONFIGURATION_REPO
const LOCAL_REPO_PATH = "./.repo"

const repoLock = new Lock()

export function usingRepo(callback) {
  return async function(req, res) {
    await repoLock.lock()
    try {
      const repo = await getRepo(CONFIGURATION_REPO, LOCAL_REPO_PATH)
      await repo.fetch("origin")
      await callback(repo, req, res)
      repoLock.unlock()
    } catch (error) {
      repoLock.unlock()
      throw error
    }
  }
}

async function getRepo(src, path) {
  try {
    return await git.Repository.open(path)
  } catch (error) {
    return await git.Clone.clone(src, path, { bare: true })
  }
}
