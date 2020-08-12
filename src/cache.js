const JSON5 = require("json5")
const get = require("lodash.get")
const isPlainObject = require("lodash.isplainobject")
const isUndefined = require("lodash.isundefined")
const mapKeys = require("lodash.mapkeys")
const Path = require("path")
const pickBy = require("lodash.pickby")
const set = require("lodash.set")

const { replaceVariablesWithValues } = require("./variables")
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
      const content = replaceVariablesWithValues(new TextDecoder("utf-8").decode(blob.content()))

      const fileData = JSON5.parse(content)
      const filepath = removeFileExtension(entry.path())

      // we parse again to get independent (cloned) data for files
      files[filepath] = JSON5.parse(content)

      // transform "index" file content into parent node
      const path = filepath.split(Path.sep)
      if (filepath.endsWith("/index")) {
        // remove "index" from path
        path.pop()

        const data = get(object, path)
        if (isUndefined(data)) {
          set(object, path, fileData)
        } else {
          if (isPlainObject(fileData)) {
            // merge index files into parent node
            const merged = { ...fileData, ...data }
            set(object, path, merged)
          }
          // else: ignore unmergable fileData
        }
      } else {
        set(object, path, fileData)
      }
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
