const JSON5 = require("json5")
const mapValues = require("lodash.mapvalues")
const minimatch = require("minimatch")
const path = require("path")

const SCHEMA_PATH = "schema.json"

exports.getSchema = async tree => {
  const entry = await tree.getEntry(SCHEMA_PATH)
  const blob = await entry.getBlob()
  return JSON5.parse(blob.content())
}

exports.isFile = function(path, files) {
  return files.some(glob => minimatch(path, glob))
}

exports.treeToObject = async tree => {
  const result = {}

  for (const entry of tree.entries()) {
    if (entry.path() !== SCHEMA_PATH) {
      const key = path.basename(entry.path(), ".json")
      result[key] = await exports.entryToObject(entry)
    }
  }

  return result
}

exports.entryToObject = async entry => {
  if (entry.isTree()) {
    const subTree = await entry.getTree()
    return exports.treeToObject(subTree)
  } else if (entry.isBlob()) {
    const blob = await entry.getBlob()
    return JSON5.parse(blob.content())
  }
}

exports.getVersion = async (repo, version) => {
  if (version === "master") {
    const master = await repo.getMasterCommit()
    return master.sha()
  } else {
    return version
  }
}

exports.response = function(version, body) {
  return {
    headers: { "Git-Commit-Hash": version },
    body
  }
}

exports.removeIndex = function({ index, ...children }) {
  return { ...index, ...mapValues(children, child => {
    if (!Array.isArray(child)) {
      return exports.removeIndex(child)
    } else {
      return child
    }
  }) }
}
