import express from "express"
import git from "nodegit"
import promisify from "promisify-node"
import rimraf from "rimraf"
import tmp from "tmp"

const rimrafAsync = promisify(rimraf)
const tmpDirAsync = promisify(tmp.dir)

const { CONFIGURATION_REPO } = process.env

export default new express.Router()
  .get("/master", getMaster)

async function getMaster(req, res) {
  const dir = await tmpDirAsync()
  const repo = await git.Clone.clone(CONFIGURATION_REPO, dir, { bare: 1 })
  const commit = await repo.getBranchCommit("master")
  res.json({ master: commit.sha() })
  await rimrafAsync(repo.path())
}
