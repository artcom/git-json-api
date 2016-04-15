import express from "express"
import git from "nodegit"

import Lock from "./lock"

const { CONFIGURATION_REPO } = process.env

const repoLock = new Lock()

export default new express.Router()
  .get("/master", withRepo(getMaster))

function withRepo(callback) {
  return async function(req, res) {
    await repoLock.lock()
    try {
      const repo = await getRepo(CONFIGURATION_REPO, "./.repo")
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

async function getMaster(repo, req, res) {
  const commit = await repo.getMasterCommit()
  res.json({ commit: commit.sha() })
}
