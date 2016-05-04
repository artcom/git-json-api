import { expect } from "chai"
import { execFileSync } from "child_process"
import { writeFileSync } from "fs"
import path from "path"
import tmp from "tmp"

import getLatestVersion from "../src/actions/getLatestVersion"

import { fetchRepo } from "../src/repo"

const schema = {
  files: [
    "dirA/*",
    "dirB/*/file"
  ]
}

describe("Git JSON API", function() {
  beforeEach(function() {
    const repoDir = tmp.dirSync({ unsafeCleanup: true }).name
    const git = (...args) => execFileSync("git", args, { cwd: repoDir }).toString().trim()

    git("init", ".")
    writeFileSync(path.join(repoDir, "schema.json"), JSON.stringify(schema))
    git("add", "schema.json")
    git("commit", "--message", "Add schema.json")

    this.version = git("show-ref", "--hash", "master")

    const cloneDir = tmp.dirSync({ unsafeCleanup: true }).name
    return fetchRepo(repoDir, cloneDir).then((repo) => { this.repo = repo })
  })

  it("returns the latest version", function() {
    return getLatestVersion(this.repo).then((result) => {
      expect(result).to.have.property("version", this.version)
    })
  })
})
