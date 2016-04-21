import express from "express"
import JSON5 from "json5"
import minimatch from "minimatch"
import path from "path"

import { usingRepo } from "./repo"

const SCHEMA_PATH = "schema.json"

export default function routes(repo) {
  return new express.Router()
    .get("/latest", usingRepo(repo, getLatestVersion))
    .get("/:version", usingRepo(repo, getRoot))
    .get("/:version/*", usingRepo(repo, getPath))
}

async function getLatestVersion(repo, req, res) {
  const commit = await repo.getReferenceCommit("refs/remotes/origin/master")
  res.json({ version: commit.sha() })
}

async function getRoot(repo, req, res) {
  const version = req.params.version

  try {
    const commit = await repo.getCommit(version)
    const tree = await commit.getTree()
    const data = await treeToObject(tree)
    res.json(data)
  } catch (error) {
    res.status(404).json({ error: error.message })
  }
}

async function getPath(repo, req, res) {
  const version = req.params.version
  const path = req.params[0]

  try {
    const commit = await repo.getCommit(version)
    const tree = await commit.getTree()
    const schema = await getSchema(tree)
    const entry = await tree.getEntry(isFile(path, schema.files) ? `${path}.json` : path)
    const data = await entryToObject(entry)
    res.json(data)
  } catch (error) {
    res.status(404).json({ error: error.message })
  }
}

async function getSchema(tree) {
  const entry = await tree.getEntry(SCHEMA_PATH)
  const blob = await entry.getBlob()
  return JSON5.parse(blob.content())
}

function isFile(path, files) {
  return files.some((glob) => minimatch(path, glob))
}

async function treeToObject(tree) {
  const result = {}

  for (const entry of tree.entries()) {
    if (entry.path() !== SCHEMA_PATH) {
      const key = path.basename(entry.path(), ".json")
      result[key] = await entryToObject(entry)
    }
  }

  return result
}

async function entryToObject(entry) {
  if (entry.isTree()) {
    const subTree = await entry.getTree()
    return treeToObject(subTree)
  } else if (entry.isBlob()) {
    const blob = await entry.getBlob()
    return JSON5.parse(blob.content())
  }
}
