const Repo = require("../src/repo")

const { createGitFunctions, createTempDir } = require("./helpers")

const rootFile = {
  foo: "bar",
  number: { baz: "foo" }
}

const nestedFile1 = {
  foo: "bar",
  number: 1
}

const nestedFile2 = ["one", "two", "three"]

describe("Get Data", function () {
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

  describe("JSON object", function () {
    test("returns complete data for master", async () => {
      const { commitHash, data } = await repo.getData("master", false, "")

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
      const { commitHash, data } = await repo.getData(oldCommitHash, false, "")

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
      return repo.getData("invalid", false, "")
        .catch(e => expect(e.message).toBe("Could not find branch or commit 'invalid'"))
    })
  })

  describe("List files", function () {
    test("returns files for master", async () => {
      const { commitHash, data } = await repo.getData("master", true, "")

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

    test("returns files for old commit hash", async () => {
      const { commitHash, data } = await repo.getData(oldCommitHash, true, "")

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

    test("returns no file for file query", async () => {
      const { commitHash, data } = await repo.getData("master", true, "rootFile")

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({})
    })

    test("returns files for directory query", async () => {
      const { commitHash, data } = await repo.getData("master", true, "dir")

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        "dir/nestedFile1": {
          foo: "bar",
          number: 1
        },
        "dir/nestedFile2": ["one", "two", "three"]
      })
    })

    test("returns error for invalid branch", () => {
      expect.assertions(1)
      return repo.getData("invalid", true)
        .catch(e => expect(e.message).toBe("Could not find branch or commit 'invalid'"))
    })
  })
})
