import { getVersion, response, treeToObject } from "./helpers"

export default async function getRoot(repo, params) {
  const version = await getVersion(repo, params.version)

  const commit = await repo.getCommit(version)
  const tree = await commit.getTree()
  return response(version, await treeToObject(tree))
}
