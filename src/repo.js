import co from "co"
import git from "nodegit"

import Lock from "./lock"

const repoLock = new Lock()

export function repoHandler(uri, callback) {
  return co.wrap(function*(req, res) {
    yield repoLock.lock()
    try {
      const repo = yield updateRepo(uri, "./.repo")
      const { headers, body } = yield callback(repo, req.params, req.body)
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
  })
}

export const updateRepo = co.wrap(function* (src, path) {
  const repo = yield getRepo(src, path)
  yield repo.fetch("origin")

  const master = yield repo.getBranch("master")
  const commit = yield repo.getReferenceCommit("refs/remotes/origin/master")
  yield master.setTarget(commit.id(), "reset master to origin/master")

  return repo
})

const getRepo = co.wrap(function*(src, path) {
  try {
    return yield git.Repository.open(path)
  } catch (error) {
    return yield git.Clone.clone(src, path, { bare: 1 })
  }
})
