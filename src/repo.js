import git from "nodegit"

import Lock from "./lock"

const repoLock = new Lock()

export function usingRepo(url, callback) {
  return async function(req, res) {
    await repoLock.lock()
    try {
      const repo = await getRepo(url, "./.repo")
      await repo.fetch("origin")
      await callback(repo, req, res)
      repoLock.unlock()
    } catch (error) {
      repoLock.unlock()
      res.status(501).json({ error: error.message })
    }
  }
}

async function getRepo(src, path) {
  try {
    return await git.Repository.open(path)
  } catch (error) {
    return await git.Clone.clone(src, path, { bare: 1 })
  }
}
