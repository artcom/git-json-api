const express = require("express")

module.exports = function routes(repo) {
  return new express.Router()
    .get("/:reference/*", handleGet)
    .post("/:reference/*", handlePost)

  async function handleGet({ params, query }, response) {
    try {
      const flatten = query.flatten === "true"
      const path = params[0] || null

      const { commitHash, data } = await repo.getData(params.reference, flatten, path)

      response.setHeader("Git-Commit-Hash", commitHash)
      response.json(data)
    } catch (error) {
      response.status(500).json({ error: error.message })
    }
  }

  async function handlePost({ body, params }, response) {
    try {
      const reference = params[0]

      const commitHash = await repo.updateData(reference, body)

      response.setHeader("Git-Commit-Hash", commitHash)
      response.end()
    } catch (error) {
      response.status(500).json({ error: error.message })
    }
  }
}
