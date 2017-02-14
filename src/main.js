const bodyParser = require("body-parser")
const bunyan = require("bunyan")
const cors = require("cors")
const express = require("express")

const routes = require("./routes")

const app = express()
const log = bunyan.createLogger({ name: "git-json-api" })
const port = process.env.PORT || 3000
const repoUri = process.env.REPO_URI

if (!repoUri) {
  log.fatal("REPO environment variable must be set")
  process.exit(1)
}

app.use(bodyParser.json({ limit: process.env.BODY_SIZE_LIMIT || "100kb" }))
app.use(cors({ exposedHeaders: ["Git-Commit-Hash"] }))
app.use("/", routes(repoUri))

app.listen(port, () => {
  log.info({ port }, "git-json-api up and running")
})
