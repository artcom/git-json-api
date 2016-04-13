import "babel-polyfill"

import bunyan from "bunyan"
import express from "express"

import routes from "./routes"

const app = express()
const log = bunyan.createLogger({ name: "git-json-api" })

app.use("/", routes)

app.listen(process.env.PORT || 3000, () => {
  log.info("git-json-api up and running")
})
