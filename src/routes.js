const express = require("express")

module.exports = function routes(repo, log) {
  return new express.Router()
    .get("/:version", handleGet)
    .get("/:version/*", handleGet)
    .post("/", handlePost)

  async function handleGet({ ip, params, query }, response) {
    const listFiles = query.listFiles === "true"
    const path = params[0] || ""
    const version = params.version

    log.info({ ip, version, path, listFiles }, "Get request received")

    try {
      const { commitHash, data } = await repo.getData(version, path, listFiles)

      response.setHeader("Git-Commit-Hash", commitHash)
      response.json(data)
    } catch (error) {
      log.error({ error: error.message })
      response.status(500).json({ error: error.message })
    }
  }

  async function handlePost({ body, ip }, response) {
    const { parentCommit, branch, path, files } = body

    log.info({ ip, parentCommit, branch, path, files }, "Update request received")

    try {
      const commitHash = await repo.updateData(parentCommit, branch, path, files)

      response.setHeader("Git-Commit-Hash", commitHash)
      response.end()
    } catch (error) {
      log.error({ error: error.message })
      response.status(500).json({ error: error.message })
    }
  }
}
