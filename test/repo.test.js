const { execFileSync } = require("child_process")
const { writeFileSync } = require("fs")
const mkdirp = require("mkdirp")
const path = require("path")
const tmp = require("tmp")

const getData = require("../src/getData")

const Repo = require("../src/repo")

const rootFile = {
  foo: "bar",
  number: { baz: "foo" }
}

const nestedFile1 = {
  foo: "bar",
  number: 1
}

const nestedFile2 = ["one", "two", "three"]

describe("Git JSON API", function () {
  let repo
  let oldCommitHash
  let masterCommitHash
  let branch1CommitHash

  beforeEach(async () => {
    const originRepoDir = createTempDir() // bare origin repo
    const workingRepoDir = createTempDir() // used to push test data into the bare origin repo
    const cloneRepoDir = createTempDir() // local clone of originRepo used by the API

    // create helper functions
    const { git, commit } = createGitFunctions(workingRepoDir)

    git("init", "--bare", originRepoDir)
    git("clone", originRepoDir, workingRepoDir)

    commit("rootFile.json", rootFile)
    oldCommitHash = commit("dir/nestedFile1.json", nestedFile1)
    git("push", "origin", "master")

    masterCommitHash = commit("dir/nestedFile2.json", nestedFile2)
    git("push", "origin", "master")

    git("branch", "branch1")
    git("checkout", "branch1")
    branch1CommitHash = commit("dir/nestedFile2.json", [...nestedFile2, "four"])
    git("push", "origin", "branch1")

    repo = new Repo(originRepoDir, cloneRepoDir)
    await repo.init()
  })

  describe("getData", function () {
    test("returns complete data for master", async () => {
      const { commitHash, data } = await repo.getData("master", false)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        "rootFile": {
          foo: "bar",
          number: { baz: "foo" }
        },
        dir: {
          "nestedFile1": {
            foo: "bar",
            number: 1
          },
          "nestedFile2": ["one", "two", "three"]
        }
      })
    })

    test("returns data of root file", async () => {
      const { commitHash, data } = await repo.getData("master", false, "rootFile")

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        foo: "bar",
        number: { baz: "foo" }
      })
    })

    test("returns data of a nested file", async () => {
      const { commitHash, data } = await repo.getData("master", false, "dir/nestedFile1")

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        foo: "bar",
        number: 1
      })
    })

    test("returns complete JSON data for old commit hash", async () => {
      const { commitHash, data } = await repo.getData(oldCommitHash, false)

      expect(commitHash).toBe(oldCommitHash)
      expect(data).toEqual({
        "rootFile": {
          foo: "bar",
          number: { baz: "foo" }
        },
        dir: {
          "nestedFile1": {
            foo: "bar",
            number: 1
          }
        }
      })
    })

    test("returns data for branch1", async () => {
      const { commitHash, data } = await repo.getData("branch1", false, "dir/nestedFile2")

      expect(commitHash).toBe(branch1CommitHash)
      expect(data).toEqual(["one", "two", "three", "four"])
    })

    test("returns error for invalid branch", () => {
      expect.assertions(1)
      return repo.getData("invalid", false)
        .catch(e => expect(e.message).toBe("Could not find branch or commit 'invalid'"))
    })
  })

  describe("getData flatten", function () {
    test("returns flatten data for master", async () => {
      const { commitHash, data } = await repo.getData("master", true)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        "rootFile": {
          foo: "bar",
          number: { baz: "foo" }
        },
        "dir/nestedFile1": {
          foo: "bar",
          number: 1
        },
        "dir/nestedFile2": ["one", "two", "three"]
      })
    })

    test("returns flatten data for old commit hash", async () => {
      const { commitHash, data } = await repo.getData(oldCommitHash, true)

      expect(commitHash).toBe(oldCommitHash)
      expect(data).toEqual({
        "rootFile": {
          foo: "bar",
          number: { baz: "foo" }
        },
        "dir/nestedFile1": {
          foo: "bar",
          number: 1
        }
      })
    })

    test("returns error for invalid branch", () => {
      expect.assertions(1)
      return repo.getData("invalid", true)
        .catch(e => expect(e.message).toBe("Could not find branch or commit 'invalid'"))
    })
  })

  function createTempDir() {
    return tmp.dirSync({ unsafeCleanup: true }).name
  }

  function createGitFunctions(workingRepoDir) {
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
      return git("show-ref", "--hash").split("\n")[0]
    }

    return { git, commit }
  }

  function last(array) {
    return array[array.length - 1]
  }
})
