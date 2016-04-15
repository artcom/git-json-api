import express from "express"

import { usingRepo } from "./repo"

export default new express.Router()
  .get("/latest", usingRepo(getMaster))

async function getMaster(repo, req, res) {
  const commit = await repo.getMasterCommit()
  res.json({ version: commit.sha() })
}
