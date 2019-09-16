const { execFileSync } = require("child_process")
const { writeFileSync } = require("fs")
const mkdirp = require("mkdirp")
const path = require("path")
const tmp = require("tmp")

const getData = require("../src/getData")
const updatePath = require("../src/updatePath")

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
      console.log(JSON.stringify(versions))
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
  })

  describe("getData", function () {
    test("returns content of a directory", async () => {
      const { body, headers } = await getData(repo, { version: "master", 0: "dirA" })

      expect(body).to.deep.equal({
        file1: fileA1
      })

      expect(headers).to.have.property("Git-Commit-Hash", last(versions))
    })

    test("returns content of a nested directory", async () => {
      const { body, headers } = await getData(repo, { version: "master", 0: "dirB/x" })

      expect(body).to.deep.equal({
        file: fileBx
      })

      expect(headers).to.have.property("Git-Commit-Hash", last(versions))
    })

    test("returns content of a file", async () => {
      const { body, headers } = await getPath(repo, { version: "master", 0: "dirB/x/file" })
      expect(body).to.deep.equal(fileBx)
      expect(headers).to.have.property("Git-Commit-Hash", last(versions))
    })
  })

  describe("updatePath", function () {
    const newFileA1 = { foo: "bar", number: 2 }

    test("writes changes to a file", async () => {
      const params = { version: last(versions), 0: "dirA" }
      const body = {
        file1: {
          foo: "bar",
          number: 2
        }
      }

      const { headers } = await updatePath(repo, params, body)

      const version = await getLatestVersion(repo)
      expect(headers).to.have.property("Git-Commit-Hash", version)

      const response = await getPath(repo, { version, 0: "dirA" })
      expect(response.body).to.deep.equal(body)
    })

    test("adds a new file", async () => {
      const fileA2 = { more: "content" }
      const params = { version: last(versions), 0: "dirA" }
      const body = {
        file1: fileA1,
        file2: fileA2
      }

      const { headers } = await updatePath(repo, params, body)
      const version = await getLatestVersion(repo)
      expect(headers).to.have.property("Git-Commit-Hash", version)

      const response1 = await getPath(repo, { version, 0: "dirA/file1" })
      expect(response1.body).to.deep.equal(fileA1)

      const response2 = await getPath(repo, { version, 0: "dirA/file2" })
      expect(response2.body).to.deep.equal(fileA2)
    })

    test("merges parallel changes", async () => {
      const params = { version: versions[1], 0: "dirA" }
      const body = { file1: newFileA1 }

      const { headers } = await updatePath(repo, params, body)
      const version = await getLatestVersion(repo)
      expect(headers).to.have.property("Git-Commit-Hash", version)

      const response = await getRoot(repo, { version })
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

    test("returns error for conflicting changes", async () => {
      const params = { version: versions[0], 0: "dirA" }
      const body = { file1: newFileA1 }

      try {
        await updatePath(repo, params, body)
        expect.fail()
      } catch (error) {
        expect(error).to.be.an("error").and.to.have.property("message", "Merge conflict")
      }
    })

    test("returns same version when nothing changes", async () => {
      const version = last(versions)
      const params = { version, 0: "dirA" }
      const body = { file1: fileA1 }

      const { headers } = await updatePath(repo, params, body)
      expect(headers).to.have.property("Git-Commit-Hash", version)
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
  return headers["Git-Commit-Hash"]
}

function last(array) {
  return array[array.length - 1]
}
