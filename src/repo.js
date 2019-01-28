const git = require("nodegit")

const { removeIndex } = require("./actions/helpers")
const Lock = require("./lock")

const repoLock = new Lock()

exports.repoHandler = function(uri, callback) {
  return async (req, res) => {
    await repoLock.lock()
    try {
      const repo = await exports.updateRepo(uri, "./.repo")
      const { headers, body } = await callback(repo, req.params, req.body)
      repoLock.unlock()

      Object.keys(headers).forEach(key => res.setHeader(key, headers[key]))

      if (body) {
        if (req.query.index === "false") {
          res.json(removeIndex(body))
        } else {
          res.json(body)
        }
      } else {
        res.end()
      }
    } catch (error) {
      repoLock.unlock()
      res.status(500).json({ error: error.message })
    }
  }
}

exports.updateRepo = async (src, path) => {
  const repo = await getRepo(src, path)
  await repo.fetch("origin")

  const master = await repo.getBranch("master")
  const commit = await repo.getReferenceCommit("refs/remotes/origin/master")
  await master.setTarget(commit.id(), "reset master to origin/master")

  return repo
}

const getRepo = async (src, path) => {
  try {
    return await git.Repository.open(path)
  } catch (error) {
    return await git.Clone.clone(src, path, { bare: 1 })
  }
}
