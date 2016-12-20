import co from "co"

import { entryToObject, getSchema, getVersion, isFile, response } from "./helpers"

export default co.wrap(function* getPath(repo, params) {
  const version = yield getVersion(repo, params.version)
  const path = params[0]

  const commit = yield repo.getCommit(version)
  const tree = yield commit.getTree()
  const schema = yield getSchema(tree)
  const entry = yield tree.getEntry(isFile(path, schema.files) ? `${path}.json` : path)
  return response(version, yield entryToObject(entry))
})
