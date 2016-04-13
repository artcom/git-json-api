const bunyan = require("bunyan")
const co = require("co")
const express = require("express")
const git = require("nodegit")
const promisify = require("promisify-node")
const rimraf = require("rimraf")
const tmp = require("tmp")

const rimrafAsync = promisify(rimraf)
const tmpDirAsync = promisify(tmp.dir)

const app = express()
const log = bunyan.createLogger({ name: "git-json-api" })

const CONFIGURATION_REPO = process.env.CONFIGURATION_REPO

app.get("/master", (req, res) => {
  co(function* () {
    const dir = yield tmpDirAsync()
    const repo = yield git.Clone.clone(CONFIGURATION_REPO, dir, { bare: 1 })
    const commit = yield repo.getBranchCommit("master")
    res.json({ master: commit.sha() })
    yield rimrafAsync(repo.path())
  })
})

app.listen(process.env.PORT || 3000, () => {
  log.info("git-json-api up and running")
})
