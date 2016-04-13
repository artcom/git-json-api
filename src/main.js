const bunyan = require("bunyan")
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
  tmpDirAsync().then((dir) =>
    git.Clone.clone(CONFIGURATION_REPO, dir, { bare: 1 })
  ).then((repo) => {
    const path = repo.path()
    res.json({ path })
    return rimrafAsync(path)
  })
})

app.listen(process.env.PORT || 3000, () => {
  log.info("git-json-api up and running")
})
