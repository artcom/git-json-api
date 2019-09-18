const get = require("lodash.get")
const git = require("nodegit")
const JSON5 = require("json5")

const Lock = require("./lock")

module.exports = class Repo {
  constructor(uri, path) {
    this.uri = uri
    this.path = path
    this.handle = null
    this.currentCommitHash = null
    this.currentData = null
    this.lock = new Lock()
  }

  async init() {
    try {
      this.handle = await git.Repository.open(this.path)
    } catch (error) {
      this.handle = await git.Clone.clone(this.uri, this.path, { bare: 1 })
    }
  }

  async getData(reference, path = "") {
    try {
      await this.lock.lock()

      await this.handle.fetch("origin")
      const commit = await getCommit(this.handle, reference)

      if (commit.sha() !== this.currentCommitHash) {
        const tree = await commit.getTree()
        this.data = await treeToObject(tree)
        this.currentCommitHash = commit.sha()
      }

      this.lock.unlock()

      if (path) {
        return { commitHash: commit.sha(), data: get(this.data, path.split("/")) }
      } else {
        return { commitHash: commit.sha(), data: this.data }
      }
    } catch (error) {
      this.lock.unlock()
      throw error
    }
  }
}

async function getCommit(repo, reference) {
  return repo.getReferenceCommit(reference)
    .catch(() => repo.getCommit(reference))
    .catch(() => { throw new Error(`Could not find branch or commit '${reference}'`) })
}

async function treeToObject(tree) {
  const result = {}

  for (const entry of tree.entries()) {
    if (entry.isFile() && entry.name().endsWith(".json")) {
      const baseFilename = entry.name().slice(0, -5)
      result[baseFilename] = await fileToObject(entry)
    } else if (entry.isTree()) {
      result[entry.name()] = await treeToObject(await entry.getTree())
    }
  }

  return result
}

async function fileToObject(entry) {
  const blob = await entry.getBlob()
  return JSON5.parse(blob.content())
}
