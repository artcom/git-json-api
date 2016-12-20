import co from "co"
import Git from "nodegit"

import { getSchema, isFile, response } from "./helpers"

export default co.wrap(function* updatePath(repo, params, data) {
  const version = params.version
  const path = params[0]

  const masterCommit = yield repo.getMasterCommit()
  const parentCommit = yield repo.getCommit(version)

  const parentTree = yield parentCommit.getTree()
  const newTree = yield createNewTree(repo, parentTree, data, path)
  const diff = yield Git.Diff.treeToTree(repo, parentTree, newTree)

  if (diff.numDeltas() === 0) {
    return response(version)
  } else {
    const newOid = yield createCommit(repo, parentCommit, masterCommit, newTree, `Update ${path}`)
    yield pushToOrigin(repo)
    return response(newOid.toString())
  }
})

const createNewTree = co.wrap(function*(repo, parentTree, data, path) {
  const schema = yield getSchema(parentTree)
  const newSubTreeOid = yield objectToTree(data, path, repo, schema)

  const builder = yield Git.Treebuilder.create(repo, parentTree)
  builder.remove(path)
  yield builder.insert(path, newSubTreeOid, Git.TreeEntry.FILEMODE.TREE)
  const newTreeOid = builder.write()
  return yield Git.Tree.lookup(repo, newTreeOid)
})

const createCommit = co.wrap(function*(repo, parentCommit, masterCommit, tree, message) {
  const signature = createSignature()

  if (parentCommit.sha() === masterCommit.sha()) {
    return yield repo.createCommit(
      "refs/heads/master",
      signature,
      signature,
      message,
      tree.id(),
      [parentCommit]
    )
  } else {
    const commitOid = yield repo.createCommit(
      null,
      signature,
      signature,
      message,
      tree.id(),
      [parentCommit]
    )

    const commit = yield repo.getCommit(commitOid)
    const index = yield Git.Merge.commits(repo, masterCommit, commit)

    if (index.hasConflicts()) {
      throw new Error("Merge conflict")
    }

    const mergeTreeOid = yield index.writeTreeTo(repo)

    return yield repo.createCommit(
      "refs/heads/master",
      signature,
      signature,
      "Merge",
      mergeTreeOid,
      [masterCommit, commit]
    )
  }
})

function createSignature() {
  return Git.Signature.now(
    process.env.SIGNATURE_NAME || "Git JSON API",
    process.env.SIGNATURE_MAIL || "mail@example.com"
  )
}

const objectToTree = co.wrap(function*(object, path, repo, schema) {
  const builder = yield Git.Treebuilder.create(repo, null)

  for (const key of Object.keys(object)) {
    const childPath = `${path}/${key}`

    if (isFile(childPath, schema.files)) {
      const buffer = new Buffer(`${JSON.stringify(object[key], null, 2)}\n`)
      const blobOid = Git.Blob.createFromBuffer(repo, buffer, buffer.length)
      yield builder.insert(`${key}.json`, blobOid, Git.TreeEntry.FILEMODE.BLOB)
    } else {
      const subTreeOid = yield objectToTree(object[key], childPath, repo, schema)
      yield builder.insert(key, subTreeOid, Git.TreeEntry.FILEMODE.TREE)
    }
  }

  return builder.write()
})

const pushToOrigin = co.wrap(function*(repo) {
  const remote = yield repo.getRemote("origin")
  const errorCode = yield remote.push("refs/heads/master:refs/heads/master")

  if (errorCode) {
    throw new Error(errorCode)
  }
})
