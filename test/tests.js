import { expect } from "chai"
import { execFileSync } from "child_process"
import { writeFileSync } from "fs"
import mkdirp from "mkdirp"
import path from "path"
import tmp from "tmp"

import getLatestVersion from "../src/actions/getLatestVersion"
import getPath from "../src/actions/getPath"
import getRoot from "../src/actions/getRoot"
import updatePath from "../src/actions/updatePath"

import { fetchRepo } from "../src/repo"

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
    const repoDir = tmp.dirSync({ unsafeCleanup: true }).name
    const upstreamDir = tmp.dirSync({ unsafeCleanup: true }).name
    const cloneDir = tmp.dirSync({ unsafeCleanup: true }).name

    this.versions = []

    const git = (...args) =>
      execFileSync("git", args, { cwd: repoDir, stdio: "pipe" })
        .toString()
        .trim()

    const commit = (filePath, content) => {
      const absPath = path.join(repoDir, filePath)
      mkdirp.sync(path.dirname(absPath))
      writeFileSync(absPath, `${JSON.stringify(content, null, 2)}\n`)
      git("add", filePath)
      git("commit", "--message", `Add ${filePath}`)
      this.versions.push(git("show-ref", "--hash", "refs/heads/master"))
    }

    git("init", "--bare", upstreamDir)
    git("clone", upstreamDir, ".")

    commit("schema.json", schema)
    commit("dirA/file1.json", fileA1)
    commit("dirB/x/file.json", fileBx)

    git("push", "origin", "master")

    this.repo = await fetchRepo(upstreamDir, cloneDir)
  })

  describe("getLatestVersion", function() {
    it("returns the latest version", async function() {
      const result = await getLatestVersion(this.repo)
      expect(result).to.have.property("version", last(this.versions))
    })
  })

  describe("getRoot", function() {
    it("returns complete JSON data for latest version", async function() {
      const data = await getRoot(this.repo, { version: last(this.versions) })

      expect(data).to.deep.equal({
        dirA: {
          file1: fileA1
        },
        dirB: {
          x: {
            file: fileBx
          }
        }
      })
    })

    it("returns complete JSON data for older version", async function() {
      const data = await getRoot(this.repo, { version: this.versions[1] })

      expect(data).to.deep.equal({
        dirA: {
          file1: fileA1
        }
      })
    })
  })

  describe("getPath", function() {
    it("returns content of a directory", async function() {
      const data = await getPath(this.repo, { version: last(this.versions), 0: "dirA" })

      expect(data).to.deep.equal({
        file1: fileA1
      })
    })

    it("returns content of a nested directory", async function() {
      const data = await getPath(this.repo, { version: last(this.versions), 0: "dirB/x" })

      expect(data).to.deep.equal({
        file: fileBx
      })
    })

    it("returns content of a file", async function() {
      const data = await getPath(this.repo, { version: last(this.versions), 0: "dirB/x/file" })
      expect(data).to.deep.equal(fileBx)
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

      const result = await updatePath(this.repo, params, body)
      const { version } = await getLatestVersion(this.repo)
      expect(result).to.have.property("version", version)

      const data = await getPath(this.repo, { version, 0: "dirA" })
      expect(data).to.deep.equal(body)
    })

    it("adds a new file", async function() {
      const fileA2 = { more: "content" }
      const params = { version: last(this.versions), 0: "dirA" }
      const body = {
        file1: fileA1,
        file2: fileA2
      }

      const result = await updatePath(this.repo, params, body)
      const { version } = await getLatestVersion(this.repo)
      expect(result).to.have.property("version", version)

      const data1 = await getPath(this.repo, { version, 0: "dirA/file1" })
      expect(data1).to.deep.equal(fileA1)

      const data2 = await getPath(this.repo, { version, 0: "dirA/file2" })
      expect(data2).to.deep.equal(fileA2)
    })

    it("merges parallel changes", async function() {
      const params = { version: this.versions[1], 0: "dirA" }
      const body = { file1: newFileA1 }

      const result = await updatePath(this.repo, params, body)
      const { version } = await getLatestVersion(this.repo)
      expect(result).to.have.property("version", version)

      const data = await getRoot(this.repo, { version })
      expect(data).to.deep.equal({
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

      const result = await updatePath(this.repo, params, body)
      expect(result).to.have.property("version", version)
    })
  })
})

function last(array) {
  return array[array.length - 1]
}
