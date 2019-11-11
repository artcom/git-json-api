const fse = require("fs-extra")
const Git = require("nodegit")
const rimraf = require("rimraf")

const Cache = require("./cache")
const Lock = require("./lock")

const CONFLICT_REGEXP = /(?:[^\r\n]*\n)?<<<<<<< ours[\s\S]*?>>>>>>> theirs(?:\n[^\r\n]*)?/g

module.exports = class Repo {
  constructor(uri, path) {
    this.uri = uri
    this.path = path
    this.repo = null
    this.lock = new Lock()
    this.cache = new Cache()
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
      const commit = await getCommitByVersion(this.repo, version)
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

  async putData(parentVersion, updateBranch, path, { files, content }) {
    try {
      await this.lock.lock()

      const parentCommit = await getCommitByVersion(this.repo, parentVersion)
      const branchCommit = await getCommitForUpdateBranch(this.repo, updateBranch || parentVersion)
      const newTreeOid = await put(this.repo, parentCommit, path, { files, content })
      const commitHash = await commitAndMerge(
        this.repo,
        parentCommit,
        branchCommit,
        newTreeOid,
        `Update '/${path}'`
      )
      await pushHeadToOrigin(this.repo, updateBranch)

      this.lock.unlock()

      return commitHash
    } catch (error) {
      this.lock.unlock()
      throw error
    }
  }
}

async function getCommitForUpdateBranch(repo, reference) {
  return repo.getReferenceCommit(`refs/remotes/origin/${reference}`)
    .catch(() => { throw new Error("Invalid or missing update branch") })
}

async function getCommitByVersion(repo, version) {
  return repo.getReferenceCommit(`refs/remotes/origin/${version}`)
    .catch(() => repo.getCommit(version))
    .catch(() => { throw new Error(`Branch or commit not found: '${version}'`) })
}

async function put(repo, parentCommit, path, { files, content }) {
  repo.setHeadDetached(parentCommit)
  await Git.Checkout.tree(repo, parentCommit, {
    checkoutStrategy:
      Git.Checkout.STRATEGY.FORCE |
      Git.Checkout.STRATEGY.REMOVE_UNTRACKED |
      Git.Checkout.STRATEGY.REMOVE_IGNORED
  })

  if (files) {
    // clear directory first
    rimraf.sync(`${repo.workdir()}${path}/*`)

    for (const file of Object.keys(files)) {
      outputJsonFile(repo.workdir(), `${path}/${file}`, files[file])
    }
  } else {
    if (content) {
      outputJsonFile(repo.workdir(), path, content)
    } else {
      throw new Error("Missing 'files' or 'content'")
    }
  }

  const index = await repo.refreshIndex()
  await index.addAll()
  await index.write()
  return await index.writeTree()
}

function outputJsonFile(workDir, filepath, content) {
  fse.outputJsonSync(`${workDir}${filepath}.json`, content, { spaces: 2 })
}

async function commitAndMerge(repo, parentCommit, branchCommit, treeOid, message) {
  const commitSignature = createSignature()
  const commitOid = await repo.createCommit(
    "HEAD",
    commitSignature,
    commitSignature,
    message,
    treeOid,
    [parentCommit]
  )

  const commit = await repo.getCommit(commitOid)

  if (await isAncestor(repo, branchCommit, commit)) {
    return commit.sha()
  } else {
    const index = await Git.Merge.commits(repo, branchCommit, commit)
    if (index.hasConflicts()) {
      const conflictReport = await createConflictReport(repo, index)
      throw new Error(`Merge conflict\n\n${conflictReport}`)
    } else {
      const mergeSignature = createSignature()
      const mergeTreeOid = await index.writeTreeTo(repo)
      const mergeCommitOid = await repo.createCommit(
        "HEAD",
        mergeSignature,
        mergeSignature,
        "Merge",
        mergeTreeOid,
        [commit, branchCommit]
      )

      const mergeCommit = await repo.getCommit(mergeCommitOid)
      return mergeCommit.sha()
    }
  }
}

function createSignature() {
  return Git.Signature.now(
    process.env.SIGNATURE_NAME || "Git JSON API",
    process.env.SIGNATURE_MAIL || "mail@example.com"
  )
}

async function pushHeadToOrigin(repo, branch) {
  const remote = await repo.getRemote("origin")
  await remote.push(`HEAD:refs/heads/${branch}`, null)

  // remote.push() does not reject nor return an error code which is a bug
  // therefore we check the new commits manually
  const headCommit = await repo.getReferenceCommit("HEAD")
  const remoteCommit = await repo.getReferenceCommit(`refs/remotes/origin/${branch}`)

  if (headCommit.sha() !== remoteCommit.sha()) {
    throw new Error("Push to remote failed")
  }
}

async function isAncestor(repo, ancestorCommit, commit) {
  const baseCommitOid = await Git.Merge.base(repo, commit.id(), ancestorCommit.id())
  return ancestorCommit.id().equal(baseCommitOid)
}

async function createConflictReport(repo, index) {
  await Git.Checkout.index(repo, index)

  return index.entries()
    .filter(entry => Git.Index.entryIsConflict(entry))
    .map(entry => entry.path)
    .filter((path, indexOfPath, self) => self.indexOf(path) === indexOfPath) // unique
    .map(path => {
      const content = fse.readFileSync(`${repo.workdir()}${path}`, "utf-8")
      const conflicts = [...content.matchAll(CONFLICT_REGEXP)].map(([conflict]) => conflict)
      return `${path}\n\n${conflicts.join("\n\n")}`
    }).join("\n\n")
}
