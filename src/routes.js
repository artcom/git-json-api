import express from "express"

import { repoHandler } from "./repo"

import getLatestVersion from "./actions/getLatestVersion"
import getRoot from "./actions/getRoot"
import getPath from "./actions/getPath"
import updatePath from "./actions/updatePath"

export default function routes(repo) {
  return new express.Router()
    .get("/latest", repoHandler(repo, getLatestVersion))
    .get("/:version", repoHandler(repo, getRoot))
    .get("/:version/*", repoHandler(repo, getPath))
    .post("/:version/*", repoHandler(repo, updatePath))
}
