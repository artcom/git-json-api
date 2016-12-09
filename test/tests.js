import { expect } from "chai"
import { execFileSync } from "child_process"
import { writeFileSync } from "fs"
import mkdirp from "mkdirp"
import path from "path"
import tmp from "tmp"

import getPath from "../src/actions/getPath"
import getRoot from "../src/actions/getRoot"
import updatePath from "../src/actions/updatePath"

import { updateRepo } from "../src/repo"

const schema = {
  files: [
    "dirA/*",
    "dirB/*/file"
  ]
}

const fileA1 = {
  foo: "bar",
  number: 1
}

const fileBx = ["one", "two", "three"]

describe("Git JSON API", function() {
  beforeEach(async function() {
    // workingRepo is used to push test data into the bare originRepo
    const workingRepoDir = createTempDir()
    const originRepoDir = createTempDir()

    // cloneRepo is the local clone of originRepo used by the API
    const cloneRepoDir = createTempDir()

    // versions contains all commit hashes
    this.versions = []

    // create helper functions
    const { git, commit } = createGitFunctions(workingRepoDir, this.versions)

    git("init", "--bare", originRepoDir)
    git("clone", originRepoDir, workingRepoDir)

    commit("schema.json", schema)
    commit("dirA/file1.json", fileA1)
    git("push", "origin", "master")
    this.repo = await updateRepo(originRepoDir, cloneRepoDir)

    commit("dirB/x/file.json", fileBx)
    git("push", "origin", "master")
    this.repo = await updateRepo(originRepoDir, cloneRepoDir)
  })

  describe("getRoot", function() {
    it("returns complete JSON data for latest version", async function() {
      const { body, headers } = await getRoot(this.repo, { version: "master" })

      expect(body).to.deep.equal({
        dirA: {
          file1: fileA1
        },
        dirB: {
          x: {
            file: fileBx
          }
        }
      })

      expect(headers).to.have.property("ETag", last(this.versions))
    })

    it("returns complete JSON data for older version", async function() {
      const version = this.versions[1]
      const { body, headers } = await getRoot(this.repo, { version })

      expect(body).to.deep.equal({
        dirA: {
          file1: fileA1
        }
      })

      expect(headers).to.have.property("ETag", version)
    })
  })

  describe("getPath", function() {
    it("returns content of a directory", async function() {
      const { body, headers } = await getPath(this.repo, { version: "master", 0: "dirA" })

      expect(body).to.deep.equal({
        file1: fileA1
      })

      expect(headers).to.have.property("ETag", last(this.versions))
    })

    it("returns content of a nested directory", async function() {
      const { body, headers } = await getPath(this.repo, { version: "master", 0: "dirB/x" })

      expect(body).to.deep.equal({
        file: fileBx
      })

      expect(headers).to.have.property("ETag", last(this.versions))
    })

    it("returns content of a file", async function() {
      const { body, headers } = await getPath(this.repo, { version: "master", 0: "dirB/x/file" })
      expect(body).to.deep.equal(fileBx)
      expect(headers).to.have.property("ETag", last(this.versions))
    })
  })

  describe("updatePath", function() {
    const newFileA1 = {
      foo: "bar",
      number: 2
    }

    it("writes changes to a file", async function() {
      const params = { version: last(this.versions), 0: "dirA" }
      const body = {
        file1: {
          foo: "bar",
          number: 2
        }
      }

      const { headers } = await updatePath(this.repo, params, body)
      const version = await getLatestVersion(this.repo)
      expect(headers).to.have.property("ETag", version)

      const response = await getPath(this.repo, { version, 0: "dirA" })
      expect(response.body).to.deep.equal(body)
    })

    it("adds a new file", async function() {
      const fileA2 = { more: "content" }
      const params = { version: last(this.versions), 0: "dirA" }
      const body = {
        file1: fileA1,
        file2: fileA2
      }

      const { headers } = await updatePath(this.repo, params, body)
      const version = await getLatestVersion(this.repo)
      expect(headers).to.have.property("ETag", version)

      const response1 = await getPath(this.repo, { version, 0: "dirA/file1" })
      expect(response1.body).to.deep.equal(fileA1)

      const response2 = await getPath(this.repo, { version, 0: "dirA/file2" })
      expect(response2.body).to.deep.equal(fileA2)
    })

    it("merges parallel changes", async function() {
      const params = { version: this.versions[1], 0: "dirA" }
      const body = { file1: newFileA1 }

      const { headers } = await updatePath(this.repo, params, body)
      const version = await getLatestVersion(this.repo)
      expect(headers).to.have.property("ETag", version)

      const response = await getRoot(this.repo, { version })
      expect(response.body).to.deep.equal({
        dirA: {
          file1: newFileA1
        },
        dirB: {
          x: {
            file: fileBx
          }
        }
      })
    })

    it("returns error for conflicting changes", async function() {
      const params = { version: this.versions[0], 0: "dirA" }
      const body = { file1: newFileA1 }

      try {
        await updatePath(this.repo, params, body)
        expect.fail()
      } catch (error) {
        expect(error).to.be.an("error").and.to.have.property("message", "Merge conflict")
      }
    })

    it("returns same version when nothing changes", async function() {
      const version = last(this.versions)
      const params = { version, 0: "dirA" }
      const body = { file1: fileA1 }

      const { headers } = await updatePath(this.repo, params, body)
      expect(headers).to.have.property("ETag", version)
    })
  })
})

function createTempDir() {
  return tmp.dirSync({ unsafeCleanup: true }).name
}

function createGitFunctions(workingRepoDir, versions) {
  function git(...args) {
    return execFileSync("git", args, { cwd: workingRepoDir, stdio: "pipe" })
      .toString()
      .trim()
  }

  function commit(filePath, content) {
    const absPath = path.join(workingRepoDir, filePath)
    mkdirp.sync(path.dirname(absPath))
    writeFileSync(absPath, `${JSON.stringify(content, null, 2)}\n`)
    git("add", filePath)
    git("commit", "--message", `Add ${filePath}`)
    versions.push(git("show-ref", "--hash", "refs/heads/master"))
  }

  return { git, commit }
}

async function getLatestVersion(repo) {
  const { headers } = await getRoot(repo, { version: "master" })
  return headers.ETag
}

function last(array) {
  return array[array.length - 1]
}
