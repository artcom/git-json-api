const git = require("isomorphic-git")
const http = require("isomorphic-git/http/node")
const fs = require("fs-extra")
const rimraf = require("rimraf")

const Cache = require("./cache")
const Lock = require("./lock")

const CONFLICT_REGEXP = /(?:[^\r\n]*\n)?<<<<<<< ours[\s\S]*?>>>>>>> theirs(?:\n[^\r\n]*)?/g

module.exports = class Repo {
  constructor(uri, dir) {
    this.uri = uri
    this.dir = dir
    this.lock = new Lock()
    this.cache = new Cache()
  }

  async init() {
    const { dir } = this
    const { GIT_REPO_URI, GIT_USER_NAME, GIT_USER_EMAIL } = process.env

    await fs.remove(dir)
    await git.clone({ fs, http, dir, url: GIT_REPO_URI })
    await git.setConfig({ fs, dir, path: "user.name", value: GIT_USER_NAME })
    await git.setConfig({ fs, dir, path: "user.email", value: GIT_USER_EMAIL })
  }

  async getData(version, path, listFiles) {
    try {
      await this.lock.lock()

      await git.fetch({ fs, http, dir: this.dir, prune: true, pruneTags: true })

      const commit = await getCommitByVersion(version)
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

  async replaceDirectory(parentVersion, updateBranch, path, author, files) {
    return this.replace(parentVersion, updateBranch, path, author, () => {
      // clear directory first
      rimraf.sync(`${this.repo.workdir()}${path}/*`)

      for (const file of Object.keys(files)) {
        fs.outputJsonSync(`${this.repo.workdir()}${path}/${file}.json`, files[file], { spaces: 2 })
      }
    })
  }

  async replaceFile(parentVersion, updateBranch, path, author, content) {
    return this.replace(parentVersion, updateBranch, path, author, () =>
      fs.outputJsonSync(`${this.repo.workdir()}${path}.json`, content, { spaces: 2 })
    )
  }

  async replace(parentVersion, updateBranch, path, author, replaceFunc) {
    try {
      await this.lock.lock()

      await git.fetch({ fs, http, dir: this.dir, prune: true, pruneTags: true })

      const parentCommit = await getCommitByVersion(this.repo, parentVersion)
      const branchCommit = await getCommitForUpdateBranch(this.repo, updateBranch || parentVersion)

      await checkoutCommit(this.repo, parentCommit)
      await replaceFunc()

      const diff = await Git.Diff.treeToWorkdir(this.repo, await parentCommit.getTree())

      let commitHash
      if (diff.numDeltas() > 0) {
        const newTreeOid = await writeIndexTree(this.repo)

        commitHash = await commitAndMerge(
          this.repo,
          parentCommit,
          branchCommit,
          newTreeOid,
          author,
          `Update '${path}'`
        )
      } else {
        commitHash = parentCommit.sha()
      }

      await pushHeadToOrigin(this.repo, updateBranch || parentVersion)

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

async function checkoutCommit(repo, commit) {
  repo.setHeadDetached(commit)
  await Git.Checkout.tree(repo, commit, {
    checkoutStrategy:
      Git.Checkout.STRATEGY.FORCE |
      Git.Checkout.STRATEGY.REMOVE_UNTRACKED |
      Git.Checkout.STRATEGY.REMOVE_IGNORED
  })
}

async function writeIndexTree(repo) {
  const index = await repo.refreshIndex()
  await index.addAll()
  await index.write()
  return index.writeTree()
}

async function commitAndMerge(repo, parentCommit, branchCommit, treeOid, author, message) {
  const commitSignature = createSignature(author)
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
      const mergeSignature = createSignature(author)
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

function createSignature(author) {
  return Git.Signature.now(author, process.env.SIGNATURE_MAIL || "mail@example.com")
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
      const content = fs.readFileSync(`${repo.workdir()}${path}`, "utf-8")
      const conflicts = [...content.matchAll(CONFLICT_REGEXP)].map(([conflict]) => conflict)
      return `${path}\n\n${conflicts.join("\n\n")}`
    }).join("\n\n")
}
