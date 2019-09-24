const express = require("express")

module.exports = function routes(repo) {
  return new express.Router()
    .get("/:version", handleGet)
    .get("/:version/*", handleGet)
    .post("/:version/*", handlePost)

  async function handleGet({ params, query }, response) {
    try {
      const listFiles = query.listFiles === "true"
      const path = params[0] || ""

      const { commitHash, data } = await repo.getData(params.version, listFiles, path)

      response.setHeader("Git-Commit-Hash", commitHash)
      response.json(data)
    } catch (error) {
      response.status(500).json({ error: error.message })
    }
  }

  async function handlePost({ body, params }, response) {
    try {
      const path = params[0] || ""

      const commitHash = await repo.updateData(params.version, body, path)

      response.setHeader("Git-Commit-Hash", commitHash)
      response.end()
    } catch (error) {
      response.status(500).json({ error: error.message })
    }
  }
}
