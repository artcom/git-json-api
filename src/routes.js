const express = require("express")

const { repoHandler } = require("./repo")

const getRoot = require("./actions/getRoot")
const getPath = require("./actions/getPath")
const updatePath = require("./actions/updatePath")

module.exports = function routes(repoUri) {
  return new express.Router()
    .get("/:version", repoHandler(repoUri, getRoot))
    .get("/:version/*", repoHandler(repoUri, getPath))
    .post("/:version/*", repoHandler(repoUri, updatePath))
}
