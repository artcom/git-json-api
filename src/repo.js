import git from "nodegit"

import Lock from "./lock"

const repoLock = new Lock()

export function repoHandler(url, callback) {
  return async function(req, res) {
    await repoLock.lock()
    try {
      const repo = await getRepo(url, "./.repo")
      await repo.fetch("origin")
      const result = await callback(repo, req.params, req.body)

      repoLock.unlock()
      res.json(result)
    } catch (error) {
      repoLock.unlock()
      console.log("Error:" + error.message)
      res.status(404).json({ error: error.message })
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
