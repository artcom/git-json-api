import Git from "nodegit"

import getLatestVersion from "./getLatestVersion"
import { getSchema, isFile } from "./helpers"

export default async function updatePath(repo, params, data) {
  const version = params.version
  const path = params[0]

  const parentCommit = await repo.getCommit(version)
  const parentTree = await parentCommit.getTree()

  const schema = await getSchema(parentTree)
  const newSubTreeOid = await objectToTree(data, path, repo, schema)

  const builder = await Git.Treebuilder.create(repo, parentTree)
  await builder.remove(path)
  await builder.insert(path, newSubTreeOid, Git.TreeEntry.FILEMODE.TREE)
  const newTreeOid = builder.write()
  const newTree = await Git.Tree.lookup(repo, newTreeOid)

  const diff = await Git.Diff.treeToTree(repo, parentTree, newTree)
  if (diff.numDeltas() === 0) {
    return { version }
  }

  const latest = await getLatestVersion(repo)
  let newOid

  if (version === latest.version) {
    newOid = await repo.createCommit(
      "refs/heads/master",
      repo.defaultSignature(),
      repo.defaultSignature(),
      `Update ${path}`,
      newTreeOid,
      [parentCommit]
    )
  } else {
    const commitOid = await repo.createCommit(
      null,
      repo.defaultSignature(),
      repo.defaultSignature(),
      `Update ${path}`,
      newTreeOid,
      [parentCommit]
    )

    const masterCommit = await repo.getCommit(latest.version)
    const commit = await repo.getCommit(commitOid)
    const index = await Git.Merge.commits(repo, masterCommit, commit)

    if (index.hasConflicts()) {
      throw new Error("Merge conflict")
    }

    const mergeTreeOid = await index.writeTreeTo(repo)

    newOid = await repo.createCommit(
      "refs/heads/master",
      repo.defaultSignature(),
      repo.defaultSignature(),
      `Merge ${path}`,
      mergeTreeOid,
      [masterCommit, commit]
    )
  }

  const remote = await repo.getRemote("origin")
  const errorCode = await remote.push("refs/heads/master:refs/heads/master")

  if (errorCode) {
    throw new Error(errorCode)
  }

  return { version: newOid.toString() }
}

async function objectToTree(object, path, repo, schema) {
  const builder = await Git.Treebuilder.create(repo, null)

  for (const key of Object.keys(object)) {
    const childPath = `${path}/${key}`

    if (isFile(childPath, schema.files)) {
      const buffer = new Buffer(`${JSON.stringify(object[key], null, 2)}\n`)
      const blobOid = Git.Blob.createFromBuffer(repo, buffer, buffer.length)
      await builder.insert(`${key}.json`, blobOid, Git.TreeEntry.FILEMODE.BLOB)
    } else {
      const subTreeOid = await objectToTree(object[key], childPath, repo, schema)
      await builder.insert(key, subTreeOid, Git.TreeEntry.FILEMODE.TREE)
    }
  }

  return builder.write()
}
