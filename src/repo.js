const fse = require("fs-extra")
const Git = require("nodegit")
const rimraf = require("rimraf")

const Cache = require("./cache")
const Lock = require("./lock")

module.exports = class Repo {
  constructor(uri, path) {
    this.uri = uri
    this.path = path
    this.repo = null
    this.lock = new Lock()
    this.cache = new Cache("0000000000000000")
  }

  async init() {
    try {
      this.repo = await Git.Repository.open(this.path)
    } catch (error) {
      this.repo = await Git.Clone.clone(this.uri, this.path)
    }
  }

  async getData(version, path, listFiles) {
    try {
      await this.lock.lock()

      await this.repo.fetch("origin")
      const commit = await getCommit(this.repo, version)
      await this.cache.update(commit)

      this.lock.unlock()

      return {
        commitHash: this.cache.getCommitHash(),
        data: listFiles ? this.cache.getFiles(path) : this.cache.getObject(path)
      }
    } catch (error) {
      this.lock.unlock()
      throw error
    }
  }

  async updateData(parentCommitHash, branch, path, files) {
    try {
      await this.lock.lock()

      const parentCommit = await this.repo.getCommit(parentCommitHash)
      const branchCommit = await this.repo.getReferenceCommit(`refs/remotes/origin/${branch}`)
      const newTreeOid = await writeFiles(this.repo, parentCommit, path, files)
      const commitHash = await commitAndMerge(this.repo, parentCommit, branchCommit, newTreeOid, `Update '/${path}'`)
      await pushHeadToOrigin(this.repo, branch)

      this.lock.unlock()

      return commitHash
    } catch (error) {
      this.lock.unlock()
      throw error
    }
  }
}

async function getCommit(repo, version) {
  return repo.getReferenceCommit(`refs/remotes/origin/${version}`)
    .catch(() => repo.getCommit(version))
    .catch(() => { throw new Error(`Branch or commit not found: '${version}'`) })
}

async function writeFiles(repo, parentCommit, path, files) {
  await Git.Reset.reset(repo, parentCommit, 3, {})

  const fqPath = `${repo.workdir().slice(0, -1)}/${path}`
  rimraf.sync(`${fqPath}/*`)

  for (const file of Object.keys(files)) {
    fse.outputJsonSync(`${fqPath}/${file}.json`, files[file], { spaces: 2 })
  }

  const index = await repo.refreshIndex()
  await index.addAll()
  await index.write()
  return await index.writeTree()
}

async function commitAndMerge(repo, parentCommit, branchCommit, treeOid, message) {
  const signature = createSignature()

  const commitOid = await repo.createCommit(
    "HEAD",
    signature,
    signature,
    message,
    treeOid,
    [parentCommit]
  )

  const commit = await repo.getCommit(commitOid)

  if (branchCommit.sha() === parentCommit.sha()) {
    return commit.sha()
  } else {
    const index = await Git.Merge.commits(repo, branchCommit, commit)
    if (index.hasConflicts()) {
      throw new Error("Merge conflict")
    }

    const mergeTreeOid = await index.writeTreeTo(repo)
    const mergeCommitOid = await repo.createCommit(
      "HEAD",
      signature,
      signature,
      "Merge",
      mergeTreeOid,
      [commit, branchCommit]
    )

    const mergeCommit = await repo.getCommit(mergeCommitOid)
    return mergeCommit.sha()
  }
}

function createSignature() {
  return Git.Signature.now(
    process.env.SIGNATURE_NAME || "Git JSON API",
    process.env.SIGNATURE_MAIL || "mail@example.com"
  )
}

async function pushHeadToOrigin(repo, branch) {
  console.log(branch)

  const remote = await repo.getRemote("origin")
  await remote.push(`HEAD:refs/heads/${branch}`, null, cb)

  // remote.push() does not reject nor return an error code which is a bug
  // therefore we check the new commits manually
  const headCommit = await repo.getReferenceCommit("HEAD")
  const remoteCommit = await repo.getReferenceCommit(`refs/remotes/origin/${branch}`)

  if (headCommit.sha() !== remoteCommit.sha()) {
    throw new Error("Push to remote failed")
  }
}
function cb(...params) {
  console.log(params)
}
