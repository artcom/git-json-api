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
      await Git.Reset.reset(this.repo, parentCommit, 3, {})

      const fqPath = `${this.repo.workdir().slice(0, -1)}/${path}`
      rimraf.sync(`${fqPath}/*`)

      for (const file of Object.keys(files)) {
        fse.outputJsonSync(`${fqPath}/${file}.json`, files[file], { spaces: 2 })
      }

      const index = await this.repo.refreshIndex()
      await index.addAll()
      await index.write()
      const newTreeOid = await index.writeTree()

      const branchCommit = await this.repo.getReferenceCommit(`refs/remotes/origin/${branch}`)
      const commitOid = await createCommit(this.repo, parentCommit, branchCommit, newTreeOid, `Update ${path}`)
      await pushHeadToOriginBranch(this.repo, branch)

      this.lock.unlock()

      return (await this.repo.getCommit(commitOid)).sha()
    } catch (error) {
      this.lock.unlock()
      throw error
    }
  }
}

async function getCommit(repo, version) {
  return repo.getReferenceCommit(`refs/remotes/origin/${version}`)
    .catch(() => repo.getCommit(version))
    .catch(() => { throw new Error(`Could not find branch or commit '${version}'`) })
}

async function createCommit(repo, parentCommit, branchCommit, treeOid, message) {
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
  const index = await Git.Merge.commits(repo, branchCommit, commit)

  if (index.hasConflicts()) {
    throw new Error("Merge conflict")
  }

  const mergeTreeOid = await index.writeTreeTo(repo)

  return await repo.createCommit(
    "HEAD",
    signature,
    signature,
    "Merge",
    mergeTreeOid,
    [commit, branchCommit]
  )
}

function createSignature() {
  return Git.Signature.now(
    process.env.SIGNATURE_NAME || "Git JSON API",
    process.env.SIGNATURE_MAIL || "mail@example.com"
  )
}

async function pushHeadToOriginBranch(repo, branch) {
  const remote = await repo.getRemote("origin")
  const errorCode = await remote.push(`HEAD:refs/heads/${branch}`)

  if (errorCode) {
    throw new Error(errorCode)
  }
}
