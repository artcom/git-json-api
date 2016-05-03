import Git from "nodegit"

import { getSchema, isFile } from "./helpers"

export default async function updatePath(repo, params, data) {
  const version = params.version
  console.log("Changed :" + version)

  const path = params[0]

  const masterCommit = await repo.getMasterCommit()
  console.log("Master version: " + masterCommit)

  const masterTree = await masterCommit.getTree()
  const schema = await getSchema(masterTree)
  const newSubTreeOid = await objectToTree(data, path, repo, schema)

  const builder = await Git.Treebuilder.create(repo, masterTree)
  await builder.remove(path)
  await builder.insert(path, newSubTreeOid, Git.TreeEntry.FILEMODE.TREE)
  const newTreeOid = builder.write()
  const newTree = await Git.Tree.lookup(repo, newTreeOid)

  let diff
  if (masterCommit.sha() !== version) {
    const ancestorCommit = await repo.getCommit(version)
    const ancestorTree = await ancestorCommit.getTree()
    const index = await Git.Merge.trees(
      repo, ancestorTree, newTree, masterTree, new Git.MergeOptions()
    )
    if (index.hasConflicts()) {
      console.log("Index has conflicts") // todo: return error response
      throw new Error("Index has conflicts")
    } else {
      console.log("Write merged tree")
      const mergedTreeOid = await index.writeTreeTo(repo)
      console.log("Get merged tree")
      const mergedTree = await Git.Tree.lookup(repo, mergedTreeOid)
      console.log("Diff trees")
      diff = await Git.Diff.treeToTree(repo, masterTree, mergedTree)
    }
  } else {
    diff = await Git.Diff.treeToTree(repo, masterTree, newTree)
  }


  if (diff.numDeltas() > 0) {
    const commitOid = await repo.createCommit(
      "refs/heads/master",
      repo.defaultSignature(),
      repo.defaultSignature(),
      `Update ${path}`,
      newTreeOid,
      [masterCommit]
    )

    const remote = await repo.getRemote("origin")
    const errorCode = await remote.push("refs/heads/master:refs/heads/master")

    if (errorCode) {
      console.log(errorCode)
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
