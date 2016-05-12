import git from "nodegit"

import Lock from "./lock"

const repoLock = new Lock()

export function repoHandler(uri, callback) {
  return async function(req, res) {
    await repoLock.lock()
    try {
      const repo = await fetchRepo(uri, "./.repo")
      const result = await callback(repo, req.params, req.body)

      repoLock.unlock()
      res.json(result)
    } catch (error) {
      repoLock.unlock()
      res.status(500).json({ error: error.message })
    }
  }
}

export async function fetchRepo(src, path) {
  const repo = await getRepo(src, path)
  await repo.fetch("origin")
  return repo
}

async function getRepo(src, path) {
  try {
    return await git.Repository.open(path)
  } catch (error) {
    return await git.Clone.clone(src, path, { bare: 1 })
  }
}
