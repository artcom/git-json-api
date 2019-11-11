const Repo = require("../src/repo")

const { copyAll, createGitFunctions, createTempDir } = require("./helpers")

describe("Update Data", () => {
  let repo
  let originRepoDir
  let masterCommitHash
  let branchCommitHash


  beforeAll(async () => {
    originRepoDir = createTempDir() // bare origin repo
    const helperRepoDir = createTempDir() // used to push test data into the bare origin repo

    // create helper functions
    const { git, commit } = createGitFunctions(helperRepoDir)

    git("init", "--bare", originRepoDir)
    git("clone", originRepoDir, helperRepoDir)

    commit("rootFile.json", { foo: "bar", })
    masterCommitHash = commit("dir/nestedFile1.json", { foo: "bar" })
    git("push", "origin", "master")

    git("branch", "branch")
    git("checkout", "branch")
    branchCommitHash = commit("dir/nestedFile2.json", { foo: "bar" })
    git("push", "origin", "branch")
  })

  beforeEach(async () => {
    const originRepoDirCopy = createTempDir()
    await copyAll(originRepoDir, originRepoDirCopy)

    repo = new Repo(originRepoDirCopy, createTempDir())
    await repo.init()
  })

  test("update root file on master", async () => {
    const files = {
      "rootFile": { foo: "baz" },
      "dir/nestedFile1": { foo: "bar" }
    }

    const newCommitHash = await repo.replacePath("master", "master", "", files)
    const commitHashResult = await repo.getData(newCommitHash, "", true)
    const masterResult = await repo.getData("master", "", true)

    expect(commitHashResult.data).toEqual(files)
    expect(commitHashResult.commitHash).toEqual(newCommitHash)
    expect(masterResult.data).toEqual(files)
    expect(masterResult.commitHash).toEqual(newCommitHash)
  })

  test("update nested file on master", async () => {
    const files = {
      nestedFile1: { foo: "baz" }
    }

    const newCommitHash = await repo.replacePath("master", "master", "dir", files)
    const commitHashResult = await repo.getData(newCommitHash, "dir", true)
    const masterResult = await repo.getData("master", "dir", true)

    expect(commitHashResult.data).toEqual(files)
    expect(commitHashResult.commitHash).toEqual(newCommitHash)
    expect(masterResult.data).toEqual(files)
    expect(masterResult.commitHash).toEqual(newCommitHash)
  })

  test("update files on branch", async () => {
    const files = {
      nestedFile1: { foo: "bar" },
      nestedFile2: { foo: "baz" }
    }

    const newCommitHash = await repo.replacePath(branchCommitHash, "branch", "dir", files)
    const commitHashResult = await repo.getData(newCommitHash, "dir", true)
    const branchResult = await repo.getData("branch", "dir", true)

    expect(commitHashResult.data).toEqual(files)
    expect(commitHashResult.commitHash).toEqual(newCommitHash)
    expect(branchResult.data).toEqual(files)
    expect(branchResult.commitHash).toEqual(newCommitHash)
  })

  test("merge parallel changes in different files", async () => {
    const files1 = {
      "rootFile": { foo: "changed" },
      "dir/nestedFile1": { foo: "bar" }
    }
    await repo.replacePath(masterCommitHash, "master", "", files1)

    const files2 = {
      "rootFile": { foo: "bar" },
      "dir/nestedFile1": { foo: "changed" }
    }
    const mergeCommitHash = await repo.replacePath(masterCommitHash, "master", "", files2)

    const { data } = await repo.getData(mergeCommitHash, "", true)

    expect(data).toEqual({
      "rootFile": { foo: "changed" },
      "dir/nestedFile1": { foo: "changed" }
    })
  })

  test("return merge conflict error", async () => {
    expect.assertions(1)

    const files1 = {
      "rootFile": { foo: "change1" },
      "dir/nestedFile1": { foo: "bar" }
    }
    await repo.replacePath(masterCommitHash, "master", "", files1)

    const files2 = {
      "rootFile": { foo: "change2" },
      "dir/nestedFile1": { foo: "bar" }
    }

    return repo.replacePath(masterCommitHash, "master", "", files2)
      .catch(e => {
        expect(e.message).toBe(
          `Merge conflict

rootFile.json

{
<<<<<<< ours
  "foo": "change1"
=======
  "foo": "change2"
>>>>>>> theirs
}`)
      })
  })

  test("update files on master parent with undefined update branch", async () => {
    const files = {
      nestedFile1: { foo: "bar" },
      nestedFile2: { foo: "baz" }
    }

    const newCommitHash = await repo.replacePath("master", undefined, "dir", files)
    const commitHashResult = await repo.getData(newCommitHash, "dir", true)

    expect(commitHashResult.data).toEqual(files)
    expect(commitHashResult.commitHash).toEqual(newCommitHash)
  })

  test("return error for commit hash parent with undefined update branch", async () => {
    expect.assertions(1)

    const files = {
      "rootFile": { foo: "change1" },
      "dir/nestedFile1": { foo: "bar" }
    }

    return repo.replacePath(masterCommitHash, undefined, "", files)
      .catch(e => {
        expect(e.message).toBe("Invalid or missing update branch")
      })
  })
})
