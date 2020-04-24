const JSON5 = require("json5")
const get = require("lodash.get")
const mapKeys = require("lodash.mapkeys")
const Path = require("path")
const pickBy = require("lodash.pickby")
const set = require("lodash.set")

/*
  Only caches data and files of the last requested commit.
*/
module.exports = class Cache {
  constructor() {
    this.commitHash = null
    this.object = {}
    this.files = {}
  }

  async update(commit) {
    if (commit.sha() !== this.commitHash) {
      const fileEntries = await this.getFileEntries(commit)
      const { object, files } = await this.buildData(fileEntries)

      this.commitHash = commit.sha()
      this.object = object
      this.files = files
    }
  }

  async getFileEntries(commit) {
    const tree = await commit.getTree()
    return new Promise((resolve, reject) => {
      const files = []
      tree.walk(true)
        .on("entry", entry => {
          if (entry.isFile() && entry.name().endsWith(".json")) {
            files.push(entry)
          }
        })
        .on("end", () => resolve(files))
        .on("error", error => reject(error))
        .start()
    })
  }

  async buildData(fileEntries) {
    const object = {}
    const files = {}

    // fileEntries are ordered breadth-first.
    // therefore subsequent entries with the same path override previous entries
    for (const entry of fileEntries) {
      const blob = await entry.getBlob()
      const content = process.env.BACKEND_HOST
        ? blob.content().replace(/\${backendHost}/g, process.env.BACKEND_HOST)
        : blob.content()

      const fileData = JSON5.parse(content)
      const filepath = removeFileExtension(entry.path())

      files[filepath] = fileData
      set(object, filepath.split(Path.sep), fileData)
    }

    return { object, files }
  }

  getCommitHash() {
    return this.commitHash
  }

  getObject(path) {
    if (path === "") {
      return this.object
    } else {
      const result = get(this.object, path.split(Path.sep))

      if (typeof result === "undefined") {
        const error = new Error("Not found")
        error.httpCode = 404
        throw error
      }

      return result
    }
  }

  getFiles(path) {
    if (path === "") {
      return this.files
    } else {
      const files = pickBy(this.files, (data, file) => file.startsWith(`${path}${Path.sep}`))

      if (Object.keys(files).length === 0) {
        const error = new Error("Not found")
        error.httpCode = 404
        throw error
      } else {
        return mapKeys(files, (data, file) => file.substr(path.length + 1))
      }
    }
  }
}

function removeFileExtension(path) {
  const { dir, name } = Path.parse(path)
  return Path.join(dir, name)
}
