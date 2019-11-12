const bodyParser = require("body-parser")
const Logger = require("bunyan")
const cors = require("cors")
const express = require("express")

const Repo = require("./repo")
const routes = require("./routes")

const app = express()

const log = Logger.createLogger({
  name: "git-json-api",
  level: "debug",
  serializers: { error: Logger.stdSerializers.err }
})
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
app.set("trust proxy", true)
app.use("/", routes(repo, log))

app.listen(port, () => {
  log.info({ port }, "Up and running")
})
