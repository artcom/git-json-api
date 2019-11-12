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
    try {
      const path = params[0] || ""
      const parent = params.parent
      const { author, content, files, updateBranch } = body
      const authorName = `${author || "Request"} from ${ip}`

      log.info(
        { author, authorName, content, files, ip, parent, path, updateBranch },
        "Put request received"
      )

      let commitHash
      if (files) {
        commitHash = await repo.replaceDirectory(parent, updateBranch, path, authorName, files)
      } else {
        if (content) {
          commitHash = await repo.replaceFile(parent, updateBranch, path, authorName, content)
        } else {
          throw new Error("Missing 'files' or 'content'")
        }
      }

      response.setHeader("Git-Commit-Hash", commitHash)
      response.end()
    } catch (error) {
      log.error({ error: error.message })
      response.status(500).json({ error: error.message })
    }
  }
}
