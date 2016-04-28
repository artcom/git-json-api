import Git from "nodegit"

import { getSchema, isFile } from "./helpers"

export default async function updatePath(repo, params, data) {
  const version = params.version
  const path = params[0]

  const commit = await repo.getCommit(version)
  const tree = await commit.getTree()
  const schema = await getSchema(tree)
  const changedTreeOid = await objectToTree(data, path, repo, schema)

  const builder = await Git.Treebuilder.create(repo, tree)
  await builder.remove(path)
  await builder.insert(path, changedTreeOid, Git.TreeEntry.FILEMODE.TREE)
  const treeOid = builder.write()

  const newTree = await Git.Tree.lookup(repo, treeOid)
  const diff = await Git.Diff.treeToTree(repo, tree, newTree)
  if (diff.numDeltas() > 0) {
    await repo.createCommit(
      "refs/heads/master",
      repo.defaultSignature(),
      repo.defaultSignature(),
      `Update ${path}`,
      treeOid,
      [commit]
    )

    const remote = await repo.getRemote("origin")
    await remote.push("refs/heads/master:refs/heads/master")
  } else {
    console.log("Nothing changed")
  }

  return {}
}

export async function objectToTree(object, path, repo, schema) {
  const builder = await Git.Treebuilder.create(repo, null)

  for (const key of Object.keys(object)) {
    if (!object.hasOwnProperty(key)) {
      continue
    }

    const childPath = `${path}/${key}`
    if (isFile(childPath, schema.files)) {
      const filename = `${key}.json`
      const buffer = new Buffer(`${JSON.stringify(object[key], null, 2)}\n`)
      const blobOid = Blob.createFromBuffer(repo, buffer, buffer.length)
      try {
        await builder.insert(filename, blobOid, Git.TreeEntry.FILEMODE.BLOB)
      } catch (e) {
        console.log(e)
      }
    } else {
      try {
        const subTreeOid = await objectToTree(object[key], childPath, repo, schema)
        await builder.insert(key, subTreeOid, Git.TreeEntry.FILEMODE.TREE)
      } catch (e) {
        console.log(e)
      }
    }
  }

  return await builder.write()
}
