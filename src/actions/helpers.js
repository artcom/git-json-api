import co from "co"
import JSON5 from "json5"
import minimatch from "minimatch"
import path from "path"

const SCHEMA_PATH = "schema.json"

export const getSchema = co.wrap(function*(tree) {
  const entry = yield tree.getEntry(SCHEMA_PATH)
  const blob = yield entry.getBlob()
  return JSON5.parse(blob.content())
})

export function isFile(path, files) {
  return files.some((glob) => minimatch(path, glob))
}

export const treeToObject = co.wrap(function*(tree) {
  const result = {}

  for (const entry of tree.entries()) {
    if (entry.path() !== SCHEMA_PATH) {
      const key = path.basename(entry.path(), ".json")
      result[key] = yield entryToObject(entry)
    }
  }

  return result
})

export const entryToObject = co.wrap(function*(entry) {
  if (entry.isTree()) {
    const subTree = yield entry.getTree()
    return treeToObject(subTree)
  } else if (entry.isBlob()) {
    const blob = yield entry.getBlob()
    return JSON5.parse(blob.content())
  }
})

export const getVersion = co.wrap(function*(repo, version) {
  if (version === "master") {
    const master = yield repo.getMasterCommit()
    return master.sha()
  } else {
    return version
  }
})

export function response(version, body) {
  return {
    headers: { ETag: version },
    body
  }
}
