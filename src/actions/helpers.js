const co = require("co")
const JSON5 = require("json5")
const minimatch = require("minimatch")
const path = require("path")

const SCHEMA_PATH = "schema.json"

exports.getSchema = co.wrap(function*(tree) {
  const entry = yield tree.getEntry(SCHEMA_PATH)
  const blob = yield entry.getBlob()
  return JSON5.parse(blob.content())
})

exports.isFile = function(path, files) {
  return files.some((glob) => minimatch(path, glob))
}

exports.treeToObject = co.wrap(function*(tree) {
  const result = {}

  for (const entry of tree.entries()) {
    if (entry.path() !== SCHEMA_PATH) {
      const key = path.basename(entry.path(), ".json")
      result[key] = yield exports.entryToObject(entry)
    }
  }

  return result
})

exports.entryToObject = co.wrap(function*(entry) {
  if (entry.isTree()) {
    const subTree = yield entry.getTree()
    return exports.treeToObject(subTree)
  } else if (entry.isBlob()) {
    const blob = yield entry.getBlob()
    return JSON5.parse(blob.content())
  }
})

exports.getVersion = co.wrap(function*(repo, version) {
  if (version === "master") {
    const master = yield repo.getMasterCommit()
    return master.sha()
  } else {
    return version
  }
})

exports.response = function(version, body) {
  return {
    headers: { "Git-Commit-Hash": version },
    body
  }
}
