const Git = require("nodegit")

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
      this.repo = await Git.Clone.clone(this.uri, this.path, { bare: 1 })
    }
  }

  async getData(version, listFiles, path) {
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
}

async function getCommit(repo, version) {
  return repo.getReferenceCommit(`refs/remotes/origin/${version}`)
    .catch(() => repo.getCommit(version))
    .catch(() => { throw new Error(`Could not find branch or commit '${version}'`) })
}
