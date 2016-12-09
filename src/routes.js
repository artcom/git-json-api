import express from "express"

import { repoHandler } from "./repo"

import getRoot from "./actions/getRoot"
import getPath from "./actions/getPath"
import updatePath from "./actions/updatePath"

export default function routes(repoUri) {
  return new express.Router()
    .get("/:version", repoHandler(repoUri, getRoot))
    .get("/:version/*", repoHandler(repoUri, getPath))
    .post("/:version/*", repoHandler(repoUri, updatePath))
}
