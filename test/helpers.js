const { execFileSync } = require("child_process")
const fse = require("fs-extra")
const tmp = require("tmp")

module.exports.createTempDir = () => {
  return tmp.dirSync().name
}

module.exports.createGitFunctions = (workingRepoDir) => {
  function git(...args) {
    return execFileSync("git", args, { cwd: workingRepoDir, stdio: "pipe" })
      .toString()
      .trim()
  }

  function commit(filePath, content) {
    fse.outputJsonSync(`${workingRepoDir}/${filePath}`, content, { spaces: 2 })
    git("add", filePath)
    git("commit", "--message", `Add ${filePath}`)
    return git("show-ref", "--hash").split("\n")[0]
  }

  return { git, commit }
}
