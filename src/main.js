import bodyParser from "body-parser"
import bunyan from "bunyan"
import cors from "cors"
import express from "express"

import routes from "./routes"

const app = express()
const log = bunyan.createLogger({ name: "git-json-api" })
const port = process.env.PORT || 3000
const repoUri = process.env.REPO_URI

if (!repoUri) {
  log.fatal("REPO environment variable must be set")
  process.exit(1)
}

app.use(bodyParser.json())
app.use(cors({ exposedHeaders: ["ETag"] }))
app.use("/", routes(repoUri))

app.listen(port, () => {
  log.info({ port }, "git-json-api up and running")
})
