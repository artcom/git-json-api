import co from "co"

import { getVersion, response, treeToObject } from "./helpers"

export default co.wrap(function* getRoot(repo, params) {
  const version = yield getVersion(repo, params.version)

  const commit = yield repo.getCommit(version)
  const tree = yield commit.getTree()
  return response(version, yield treeToObject(tree))
})
