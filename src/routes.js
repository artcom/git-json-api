import bodyParser from "body-parser"
import express from "express"
import JSON5 from "json5"
import minimatch from "minimatch"
import { Blob, Commit, Diff, Treebuilder, Tree, TreeEntry } from "nodegit"
import path from "path"

import { usingRepo } from "./repo"

const SCHEMA_PATH = "schema.json"

export default function routes(repo) {
  return new express.Router()
    .get("/latest", usingRepo(repo, getLatestVersion))
    .get("/:version", usingRepo(repo, getRoot))
    .get("/:version/*", usingRepo(repo, getPath))
    .post("/:version/*", bodyParser.json(), usingRepo(repo, updatePath))
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

async function updatePath(repo, req, res) {
  const path = req.params[0]
  const data = req.body
  const version = req.params.version

  try {
    const parent = await repo.getCommit(version)
    const tree = await parent.getTree()
    const schema = await getSchema(tree)
    const changedTreeOid = await objectToTree(data, path, repo, schema)

    const treeBuilder = await Treebuilder.create(repo, tree)
    await treeBuilder.remove(path)
    await treeBuilder.insert(path, changedTreeOid, TreeEntry.FILEMODE.TREE)
    const treeOid = treeBuilder.write()

    const newTree = await Tree.lookup(repo, treeOid)
    const diff = await Diff.treeToTree(repo, tree, newTree)
    if (diff.numDeltas() > 0) {
      const commitOid = await repo.createCommit(
        "refs/heads/master",
        repo.defaultSignature(),
        repo.defaultSignature(),
        `Update ${path}`,
        treeOid,
        [parent]
      )

      const remote = await repo.getRemote("origin")
      const errorCode = await remote.push("refs/heads/master:refs/heads/master")

      if (errorCode) {
        res.status(404).json({ error: errorCode })
      } else {
        const commit = await Commit.lookup(repo, commitOid)
        res.json({ version: commit.sha() })
      }
    } else {
      console.log("Nothing changed")
      res.end()
    }
  } catch (error) {
    console.log(error)
    res.status(404).json({ error: error.message })
  }
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

async function getSchema(tree) {
  const entry = await tree.getEntry(SCHEMA_PATH)
  const blob = await entry.getBlob()
  return JSON5.parse(blob.content())
}

async function objectToTree(object, path, repo, schema) {
  const treeBuilder = await Treebuilder.create(repo, null)

  for (const key of Object.keys(object)) {
    if (!object.hasOwnProperty(key)) {
      continue
    }

    const childPath = `${path}/${key}`
    if (isFile(childPath, schema.files)) {
      const filename = `${key}.json`
      const buffer = new Buffer(`${JSON.stringify(object[key], null, 2)}\n`)
      const blobOid = Blob.createFromBuffer(repo, buffer, buffer.length)
      try {
        await treeBuilder.insert(filename, blobOid, TreeEntry.FILEMODE.BLOB)
      } catch (e) {
        console.log(e)
      }
    } else {
      try {
        const subTreeOid = await objectToTree(object[key], childPath, repo, schema)
        await treeBuilder.insert(key, subTreeOid, TreeEntry.FILEMODE.TREE)
      } catch (e) {
        console.log(e)
      }
    }
  }

  return await treeBuilder.write()
}

function isFile(path, files) {
  return files.some((glob) => minimatch(path, glob))
}
