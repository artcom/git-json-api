import { treeToObject } from "./helpers"

export default async function getRoot(repo, params) {
  const version = params.version

  const commit = await repo.getCommit(version)
  const tree = await commit.getTree()
  return await treeToObject(tree)
}
