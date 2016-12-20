const co = require("co")

const { getVersion, response, treeToObject } = require("./helpers")

module.exports = co.wrap(function* getRoot(repo, params) {
  const version = yield getVersion(repo, params.version)

  const commit = yield repo.getCommit(version)
  const tree = yield commit.getTree()
  return response(version, yield treeToObject(tree))
})
