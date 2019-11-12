const express = require("express")
const Path = require("path")

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
      log.error({ error })
      response.status(error.httpCode || 500).json({ error: error.message })
    }
  }

  async function putData({ body, ip, params }, response) {
    try {
      const providedPath = params[0] || ""
      const parent = params.parent
      const { author: providedAuthor, fileContent, files, updateBranch } = body

      log.info(
        { providedAuthor, fileContent, files, ip, parent, providedPath, updateBranch },
        "Put request received"
      )

      const { dir, base } = Path.parse(providedPath)
      const path = Path.join(dir, base)
      const author = `${providedAuthor || "Request"} from ${ip}`

      let commitHash
      if (files) {
        commitHash = await repo.replaceDirectory(parent, updateBranch, path, author, files)
      } else {
        if (fileContent) {
          commitHash = await repo.replaceFile(parent, updateBranch, path, author, fileContent)
        } else {
          throw new Error("Missing 'files' or 'fileContent'")
        }
      }

      response.setHeader("Git-Commit-Hash", commitHash)
      response.end()
    } catch (error) {
      log.error({ error })
      response.status(500).json({ error: error.message })
    }
  }
}
