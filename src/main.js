import "babel-polyfill"

import bunyan from "bunyan"
import express from "express"

import routes from "./routes"

const app = express()
const log = bunyan.createLogger({ name: "git-json-api" })
const port = process.env.PORT || 3000

app.use("/", routes)

app.listen(port, () => {
  log.info({ port }, "git-json-api up and running")
})
