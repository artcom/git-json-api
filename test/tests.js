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
  beforeEach(function() {
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
      writeFileSync(absPath, JSON.stringify(content))
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

    return fetchRepo(upstreamDir, cloneDir).then((repo) => { this.repo = repo })
  })

  describe("getLatestVersion", function() {
    it("returns the latest version", function() {
      return getLatestVersion(this.repo).then((result) => {
        expect(result).to.have.property("version", last(this.versions))
      })
    })
  })

  describe("getRoot", function() {
    it("returns complete JSON data for latest version", function() {
      return getRoot(this.repo, { version: last(this.versions) }).then((data) => {
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
    })

    it("returns complete JSON data for older version", function() {
      return getRoot(this.repo, { version: this.versions[1] }).then((data) => {
        expect(data).to.deep.equal({
          dirA: {
            file1: fileA1
          }
        })
      })
    })
  })

  describe("getPath", function() {
    it("returns content of a directory", function() {
      return getPath(this.repo, { version: last(this.versions), 0: "dirA" }).then((data) => {
        expect(data).to.deep.equal({
          file1: fileA1
        })
      })
    })

    it("returns content of a nested directory", function() {
      return getPath(this.repo, { version: last(this.versions), 0: "dirB/x" }).then((data) => {
        expect(data).to.deep.equal({
          file: fileBx
        })
      })
    })

    it("returns content of a file", function() {
      return getPath(this.repo, { version: last(this.versions), 0: "dirB/x/file" }).then((data) => {
        expect(data).to.deep.equal(fileBx)
      })
    })
  })

  describe("updatePath", function() {
    it("writes changes to a file", function() {
      const params = { version: last(this.versions), 0: "dirA" }
      const body = {
        file1: {
          foo: "bar",
          number: 2
        }
      }

      return updatePath(this.repo, params, body).then((result) => {
        expect(result).to.have.property("version")

        return getPath(this.repo, { version: result.version, 0: "dirA" }).then((data) => {
          expect(data).to.deep.equal(body)
        })
      })
    })
  })
})

function last(array) {
  return array[array.length - 1]
}
