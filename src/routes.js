import express from "express"

import { repoHandler } from "./repo"

import getLatestVersion from "./actions/getLatestVersion"
import getRoot from "./actions/getRoot"
import getPath from "./actions/getPath"
import updatePath from "./actions/updatePath"

export default function routes(repoUri) {
  return new express.Router()
    .get("/latest", repoHandler(repoUri, getLatestVersion))
    .get("/:version", repoHandler(repoUri, getRoot))
    .get("/:version/*", repoHandler(repoUri, getPath))
    .post("/:version/*", repoHandler(repoUri, updatePath))
}
