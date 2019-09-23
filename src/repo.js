const git = require("nodegit")

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
      this.repo = await git.Repository.open(this.path)
    } catch (error) {
      this.repo = await git.Clone.clone(this.uri, this.path, { bare: 1 })
    }
  }

  async getData(reference, flatten, path) {
    try {
      await this.lock.lock()

      await this.repo.fetch("origin")
      const commit = await getCommit(this.repo, reference)
      await this.cache.update(commit)

      this.lock.unlock()

      return {
        commitHash: this.cache.getCommitHash(),
        data: flatten ? this.cache.getFiles(path) : this.cache.getObject(path)
      }
    } catch (error) {
      this.lock.unlock()
      throw error
    }
  }
}

async function getCommit(repo, reference) {
  return repo.getReferenceCommit(`refs/remotes/origin/${reference}`)
    .catch(() => repo.getCommit(reference))
    .catch(() => { throw new Error(`Could not find branch or commit '${reference}'`) })
}
