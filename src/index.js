const Logger = require("bunyan")
const cors = require("cors")
const express = require("express")
const compression = require("compression")

const Repo = require("./repo")
const routes = require("./routes")

const app = express()
app.use(compression())

const log = Logger.createLogger({
  name: "git-json-api",
  level: "debug",
  serializers: { error: Logger.stdSerializers.err }
})
const port = process.env.PORT || 3000
const repoUri = process.env.REPO_URI

if (!repoUri) {
  log.fatal("REPO_URI environment variable must be set")
  process.exit(1)
}

const repo = new Repo(repoUri, "./.repo")
repo.init()
app.use(express.text({ type: "application/json", limit: process.env.BODY_SIZE_LIMIT || "100kb" }))
app.use(cors({ exposedHeaders: ["Git-Commit-Hash"] }))
app.set("trust proxy", true)
app.use("/", routes(repo, log))

app.listen(port, () => {
  log.info({ port }, "Up and running")
})
