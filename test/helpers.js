const { execFileSync } = require("child_process")
const { writeFileSync } = require("fs")
const mkdirp = require("mkdirp")
const path = require("path")
const tmp = require("tmp")

module.exports.createTempDir = () => {
  return tmp.dirSync({ unsafeCleanup: true }).name
}

module.exports.createGitFunctions = (workingRepoDir) => {
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
