const bodyParser = require("body-parser")
const bunyan = require("bunyan")
const cors = require("cors")
const express = require("express")

const Repo = require("./repo")
const routes = require("./routes")

const app = express()
const log = bunyan.createLogger({ name: "git-json-api" })
const port = process.env.PORT || 3000
const repoUri = process.env.REPO_URI

if (!repoUri) {
  log.fatal("REPO environment variable must be set")
  process.exit(1)
}

const repo = new Repo(repoUri, "./.repo")
repo.init()

app.use(bodyParser.json({ limit: process.env.BODY_SIZE_LIMIT || "100kb" }))
app.use(cors({ exposedHeaders: ["Git-Commit-Hash"] }))
app.use("/", routes(repo, log))

app.listen(port, () => {
  log.info({ port }, "Up and running")
})
