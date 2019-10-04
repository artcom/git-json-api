const Repo = require("../src/repo")

const { copyAll, createGitFunctions, createTempDir } = require("./helpers")

const rootFile = {
  foo: "bar",
  number: { baz: "foo" }
}

const nestedFile1 = {
  foo: "bar",
  number: 1
}

const nestedFile2 = ["one", "two", "three"]

describe("Get Data", () => {
  let repo
  let originRepoDir
  let oldCommitHash
  let masterCommitHash
  let branch1CommitHash
  let branch2CommitHash

  beforeAll(async () => {
    originRepoDir = createTempDir() // bare origin repo
    const workingRepoDir = createTempDir() // used to push test data into the bare origin repo

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

    git("checkout", "master")
    git("branch", "branch2")
    git("checkout", "branch2")
    branch2CommitHash = commit("dir.json", {
      nestedFile1: "shouldBeOverwrittenByFilesInSubdirectory"
    })
    git("push", "origin", "branch2")
  })

  beforeEach(async () => {
    const originRepoDirForTest = createTempDir()
    await copyAll(originRepoDir, originRepoDirForTest)

    repo = new Repo(originRepoDirForTest, createTempDir())
    await repo.init()
  })

  describe("JSON object", () => {
    test("returns data for master", async () => {
      const { commitHash, data } = await repo.getData("master", "", false)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        rootFile: {
          foo: "bar",
          number: { baz: "foo" }
        },
        dir: {
          nestedFile1: {
            foo: "bar",
            number: 1
          },
          nestedFile2: ["one", "two", "three"]
        }
      })
    })

    test("returns data of root file", async () => {
      const { commitHash, data } = await repo.getData("master", "rootFile", false)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        foo: "bar",
        number: { baz: "foo" }
      })
    })

    test("returns data of a nested file", async () => {
      const { commitHash, data } = await repo.getData("master", "dir/nestedFile1", false)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        foo: "bar",
        number: 1
      })
    })

    test("returns data of a directory", async () => {
      const { commitHash, data } = await repo.getData("master", "dir", false)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        nestedFile1: {
          foo: "bar",
          number: 1
        },
        nestedFile2: ["one", "two", "three"]
      })
    })

    test("returns data of a JSON node", async () => {
      const { commitHash, data } = await repo.getData("master", "dir/nestedFile1/foo", false)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual("bar")
    })

    test("returns data for commit hash", async () => {
      const { commitHash, data } = await repo.getData(oldCommitHash, "", false)

      expect(commitHash).toBe(oldCommitHash)
      expect(data).toEqual({
        rootFile: {
          foo: "bar",
          number: { baz: "foo" }
        },
        dir: {
          nestedFile1: {
            foo: "bar",
            number: 1
          }
        }
      })
    })

    test("returns data for branch", async () => {
      const { commitHash, data } = await repo.getData("branch1", "dir/nestedFile2", false)

      expect(commitHash).toBe(branch1CommitHash)
      expect(data).toEqual(["one", "two", "three", "four"])
    })

    test("overwrites file content with same-name subdirectory content", async () => {
      const { commitHash, data } = await repo.getData("branch2", "dir", false)

      expect(commitHash).toBe(branch2CommitHash)
      expect(data).toEqual({
        nestedFile1: {
          foo: "bar",
          number: 1
        },
        nestedFile2: ["one", "two", "three"]
      })
    })

    test("returns error with status 404 for non-existing directory", async () => {
      expect.assertions(2)
      return repo.getData("master", "doesnotexist", false)
        .catch(e => {
          expect(e.httpCode).toBe(404)
          expect(e.message).toBe("Not found")
        })
    })

    test("returns error for invalid branch", () => {
      expect.assertions(1)
      return repo.getData("invalid", "", false)
        .catch(e => expect(e.message).toBe("Branch or commit not found: 'invalid'"))
    })
  })

  describe("List files", () => {
    test("returns files for master", async () => {
      const { commitHash, data } = await repo.getData("master", "", true)

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

    test("returns files for commit hash", async () => {
      const { commitHash, data } = await repo.getData(oldCommitHash, "", true)

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
      const { commitHash, data } = await repo.getData("master", "rootFile", true)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({})
    })

    test("returns no file for non-existing directory", async () => {
      const { commitHash, data } = await repo.getData("master", "doesnotexist", true)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({})
    })

    test("returns files for directory query", async () => {
      const { commitHash, data } = await repo.getData("master", "dir", true)

      expect(commitHash).toBe(masterCommitHash)
      expect(data).toEqual({
        nestedFile1: {
          foo: "bar",
          number: 1
        },
        nestedFile2: ["one", "two", "three"]
      })
    })

    test("returns error for invalid branch", () => {
      expect.assertions(1)
      return repo.getData("invalid", "", true)
        .catch(e => expect(e.message).toBe("Branch or commit not found: 'invalid'"))
    })
  })
})
