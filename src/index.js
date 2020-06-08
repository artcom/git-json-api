const bodyParser = require("body-parser")
const { createLogger } = require("@artcom/logger")
const cors = require("cors")
const express = require("express")

const Repo = require("./repo")
const routes = require("./routes")

const app = express()
const logger = createLogger()

const PORT = process.env.PORT || 3000

if (!process.env.REPO_URI) {
  logger.error("REPO environment variable must be set")
  process.exit(1)
}

const repo = new Repo(process.env.REPO_URI, "./.repo")
repo.init()

app.use(bodyParser.json({ limit: process.env.BODY_SIZE_LIMIT || "100kb" }))
app.use(cors({ exposedHeaders: ["Git-Commit-Hash"] }))
app.set("trust proxy", true)
app.use("/", routes(repo, logger))

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Up and running")
})
