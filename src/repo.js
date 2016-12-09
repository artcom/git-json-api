import git from "nodegit"

import Lock from "./lock"

const repoLock = new Lock()

export function repoHandler(uri, callback) {
  return async function(req, res) {
    await repoLock.lock()
    try {
      const repo = await updateRepo(uri, "./.repo")
      const { headers, body } = await callback(repo, req.params, req.body)
      repoLock.unlock()

      Object.keys(headers).forEach((key) => {
        res.setHeader(key, headers[key])
      })

      if (body) {
        res.json(body)
      } else {
        res.end()
      }
    } catch (error) {
      repoLock.unlock()
      res.status(500).json({ error: error.message })
    }
  }
}

export async function updateRepo(src, path) {
  const repo = await getRepo(src, path)
  await repo.fetch("origin")

  const master = await repo.getBranch("master")
  const commit = await repo.getReferenceCommit("refs/remotes/origin/master")
  await master.setTarget(commit.id(), "reset master to origin/master")

  return repo
}

async function getRepo(src, path) {
  try {
    return await git.Repository.open(path)
  } catch (error) {
    return await git.Clone.clone(src, path, { bare: 1 })
  }
}
