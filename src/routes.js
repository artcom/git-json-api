const express = require("express")

const { requestHandler } = require("./requestHandler")

const getData = require("./getData")
const updatePath = require("./updatePath")

module.exports = function routes(repo) {
  return new express.Router()
    .get("/:reference/*", requestHandler(repo, getData))
    .post("/:reference/*", requestHandler(repo, updatePath))
}
