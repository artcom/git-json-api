import Git from "nodegit"

import { getSchema, isFile } from "./helpers"

export default async function updatePath(repo, params, data) {
  const version = params.version
  const path = params[0]

  const parent = await repo.getCommit(version)
  const tree = await parent.getTree()
  const schema = await getSchema(tree)
  const newSubTreeOid = await objectToTree(data, path, repo, schema)

  const builder = await Git.Treebuilder.create(repo, tree)
  await builder.remove(path)
  await builder.insert(path, newSubTreeOid, Git.TreeEntry.FILEMODE.TREE)
  const newTreeOid = builder.write()

  const newTree = await Git.Tree.lookup(repo, newTreeOid)
  const diff = await Git.Diff.treeToTree(repo, tree, newTree)

  if (diff.numDeltas() > 0) {
    const commitOid = await repo.createCommit(
      "refs/heads/master",
      repo.defaultSignature(),
      repo.defaultSignature(),
      `Update ${path}`,
      newTreeOid,
      [parent]
    )

    const remote = await repo.getRemote("origin")
    const errorCode = await remote.push("refs/heads/master:refs/heads/master")
    if (errorCode) {
      throw new Error(errorCode)
    } else {
      const commit = await Git.Commit.lookup(repo, commitOid)
      return { version: commit.sha() }
    }
  } else {
    console.log("Nothing changed")
    return {}
  }
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
      const blobOid = Git.Blob.createFromBuffer(repo, buffer, buffer.length)
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
