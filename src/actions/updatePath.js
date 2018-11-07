const Git = require("nodegit")

const { getSchema, isFile, response } = require("./helpers")

module.exports = async (repo, params, data) => {
  const version = params.version
  const path = params[0]

  const masterCommit = await repo.getMasterCommit()
  const parentCommit = await repo.getCommit(version)

  const parentTree = await parentCommit.getTree()

  const newTree = await createNewTree(repo, parentTree, data, path)

  const diff = await Git.Diff.treeToTree(repo, parentTree, newTree)

  if (diff.numDeltas() === 0) {
    return response(version)
  } else {
    const newOid = await createCommit(repo, parentCommit, masterCommit, newTree, `Update ${path}`)
    await pushToOrigin(repo)
    return response(newOid.toString())
  }
}

const createNewTree = async (repo, parentTree, data, path) => {
  const schema = await getSchema(parentTree)
  const newSubTreeOid = await objectToTree(data, path, repo, schema)

  const builder = await Git.Treebuilder.create(repo, parentTree)
  builder.remove(path)
  await builder.insert(path, newSubTreeOid, Git.TreeEntry.FILEMODE.TREE)
  const newTreeOid = await builder.write()
  return await Git.Tree.lookup(repo, newTreeOid)
}

const createCommit = async (repo, parentCommit, masterCommit, tree, message) => {
  const signature = createSignature()

  if (parentCommit.sha() === masterCommit.sha()) {
    return await repo.createCommit(
      "refs/heads/master",
      signature,
      signature,
      message,
      tree.id(),
      [parentCommit]
    )
  } else {
    const commitOid = await repo.createCommit(
      null,
      signature,
      signature,
      message,
      tree.id(),
      [parentCommit]
    )

    const commit = await repo.getCommit(commitOid)
    const index = await Git.Merge.commits(repo, masterCommit, commit)

    if (index.hasConflicts()) {
      throw new Error("Merge conflict")
    }

    const mergeTreeOid = await index.writeTreeTo(repo)

    return await repo.createCommit(
      "refs/heads/master",
      signature,
      signature,
      "Merge",
      mergeTreeOid,
      [masterCommit, commit]
    )
  }
}

function createSignature() {
  return Git.Signature.now(
    process.env.SIGNATURE_NAME || "Git JSON API",
    process.env.SIGNATURE_MAIL || "mail@example.com"
  )
}

const objectToTree = async (object, path, repo, schema) => {
  const builder = await Git.Treebuilder.create(repo, null)

  for (const key of Object.keys(object)) {
    const childPath = `${path}/${key}`

    if (isFile(childPath, schema.files)) {
      const buffer = Buffer.from(`${JSON.stringify(object[key], null, 2)}\n`)
      const blobOid = await Git.Blob.createFromBuffer(repo, buffer, buffer.length)
      await builder.insert(`${key}.json`, blobOid, Git.TreeEntry.FILEMODE.BLOB)
    } else {
      const subTreeOid = await objectToTree(object[key], childPath, repo, schema)
      await builder.insert(key, subTreeOid, Git.TreeEntry.FILEMODE.TREE)
    }
  }

  return builder.write()
}

const pushToOrigin = async repo => {
  const remote = await repo.getRemote("origin")
  const errorCode = await remote.push("refs/heads/master:refs/heads/master")

  if (errorCode) {
    throw new Error(errorCode)
  }
}
