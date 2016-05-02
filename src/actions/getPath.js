import { entryToObject, getSchema, isFile } from "./helpers"

export default async function getPath(repo, params) {
  const version = params.version
  const path = params[0]

  const commit = await repo.getCommit(version)
  const tree = await commit.getTree()
  const schema = await getSchema(tree)
  const entry = await tree.getEntry(isFile(path, schema.files) ? `${path}.json` : path)
  return await entryToObject(entry)
}
