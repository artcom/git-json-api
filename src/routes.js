const express = require("express")

module.exports = function routes(repo, log) {
  return new express.Router()
    .get("/:version", getData)
    .get("/:version/*", getData)
    .put("/:parent", putData)
    .put("/:parent/*", putData)

  async function getData({ ip, params, query }, response) {
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
      response.status(error.httpCode || 500).json({ error: error.message })
    }
  }

  async function putData({ body, ip, params }, response) {
    const path = params[0] || ""
    const parent = params.parent
    const { updateBranch, files, content } = body

    log.info({ ip, parent, updateBranch, path, files, content }, "Update request received")

    try {
      const commitHash = await repo.putData(parent, updateBranch, path, { files, content })

      response.setHeader("Git-Commit-Hash", commitHash)
      response.end()
    } catch (error) {
      log.error({ error: error.message })
      response.status(500).json({ error: error.message })
    }
  }
}
