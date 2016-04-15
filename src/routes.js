import express from "express"

import { usingRepo } from "./repo"

export default new express.Router()
  .get("/latest", usingRepo(getMaster))
  .get("/config/:version", usingRepo(getConfig))

async function getMaster(repo, req, res) {
  const commit = await repo.getMasterCommit()
  res.json({ version: commit.sha() })
}

async function getConfig(repo, req, res) {
  try {
    const version = req.params.version
    const commit = await repo.getCommit(version)
    res.json({ version: commit.sha() })
  } catch (error) {
    res.status(404).end()
  }
}
