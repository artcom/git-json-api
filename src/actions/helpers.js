import JSON5 from "json5"
import minimatch from "minimatch"
import path from "path"

const SCHEMA_PATH = "schema.json"

export async function getSchema(tree) {
  const entry = await tree.getEntry(SCHEMA_PATH)
  const blob = await entry.getBlob()
  return JSON5.parse(blob.content())
}

export function isFile(path, files) {
  return files.some((glob) => minimatch(path, glob))
}

export async function treeToObject(tree) {
  const result = {}

  for (const entry of tree.entries()) {
    if (entry.path() !== SCHEMA_PATH) {
      const key = path.basename(entry.path(), ".json")
      result[key] = await entryToObject(entry)
    }
  }

  return result
}

export async function entryToObject(entry) {
  if (entry.isTree()) {
    const subTree = await entry.getTree()
    return treeToObject(subTree)
  } else if (entry.isBlob()) {
    const blob = await entry.getBlob()
    return JSON5.parse(blob.content())
  }
}
