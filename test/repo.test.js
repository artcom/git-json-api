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
  let repo = null
  let versions = []

  beforeEach(async () => {
    versions = []

    const originRepoDir = createTempDir() // bare origin repo
    const workingRepoDir = createTempDir() // used to push test data into the bare origin repo
    const cloneRepoDir = createTempDir() // local clone of originRepo used by the API

    // create helper functions
    const { git, commit } = createGitFunctions(workingRepoDir, versions)

    git("init", "--bare", originRepoDir)
    git("clone", originRepoDir, workingRepoDir)

    commit("rootFile.json", rootFile)
    commit("dir/nestedFile1.json", nestedFile1)
    git("push", "origin", "master")

    commit("dir/nestedFile2.json", nestedFile2)
    git("push", "origin", "master")

    repo = new Repo(originRepoDir, cloneRepoDir)
    await repo.init()
  })

  describe("getData", function () {
    test.only("returns complete data for master", async () => {
      const { commitHash, data } = await repo.getData("master")

      expect(commitHash).toBe(last(versions))
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

    test.only("returns data of root file", async () => {
      const { commitHash, data } = await repo.getData("master", "rootFile")

      expect(commitHash).toBe(last(versions))
      expect(data).toEqual({
        foo: "bar",
        number: { baz: "foo" }
      })
    })

    test.only("returns data of a nested file", async () => {
      const { commitHash, data } = await repo.getData("master", "dir/nestedFile1")

      expect(commitHash).toBe(last(versions))
      expect(data).toEqual({
        foo: "bar",
        number: 1
      })
    })

    test.only("returns complete JSON data for older version", async () => {
      const { commitHash, data } = await repo.getData(versions[1])

      expect(commitHash).toBe(versions[1])
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

    test.only("returns error for invalid branch", () => {
      expect.assertions(1)
      return repo.getData("invalid")
        .catch(e => expect(e.message).toBe("Could not find branch or commit 'invalid'"))
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
    return headers["Git-Commit-Hash"]
  }

  function last(array) {
    return array[array.length - 1]
  }
})
