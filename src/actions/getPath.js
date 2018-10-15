const { entryToObject, getSchema, getVersion, isFile, response } = require("./helpers")

module.exports = async (repo, params) => {
  const version = await getVersion(repo, params.version)
  const path = params[0]

  const commit = await repo.getCommit(version)
  const tree = await commit.getTree()
  const schema = await getSchema(tree)
  const entry = await tree.getEntry(isFile(path, schema.files) ? `${path}.json` : path)
  return response(version, await entryToObject(entry))
}
