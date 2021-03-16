# Notice

**The development of this project is continued in https://github.com/artcom/acms-api.**

**For the sake of backwards compatibility this repository is archived and set to read-only.**

# Git JSON API

A JSON API to serve the contents of JSON files from a Git repo. All files in the repo are expected to be JSON files with a `.json` extension.

## Configuration

### Environment Variables

The service uses the following environment variables:

* `REPO_URI` _(required)_ URI of the Git repository
* `SIGNATURE_MAIL` _(optional)_ E-mail address used for generated commits
* `REPO_TOKEN` _(optional)_ Token for accessing private repo
* `GIT_JSON_API_VAR_*`_(optional)_ A list of variables to be replaced in the content (see "Variable Replacement" for details)

### Variable Replacement

The service replaces variables in files when serving and writing. All variables need to be environment variables prefixed with `GIT_JSON_API_VAR_`. Example:
```
export GIT_JSON_API_VAR_MY_FANCY_VARIABLE="value"
```

If a variable occurs in the content it will be replaced by the given value. When writing to the repo values will also be replaced by their variable name.

**Example**
```
Content:                          "Hello ${properGreeting}."  
GIT_JSON_API_VAR_PROPER_GREETING: "World"  
Served:                           "Hello World."
````

## API

### `GET /:version`

Returns the contents of the repo at the given version as a single JSON object.

Version can either be a Git commit hash or a reference. The response will contain the Git commit hash in the `Git-Commit-Hash` header.

The returned object contains the contents of every file in the root of the repo in a property named like the file (without extension). For every directory, it contains another object with the same structure.

If a repo contains `file1.json`, `file2.json`, `directory/fileA.json` and `directory/subDirectory/fileB.json`, the response would be structured as follows:

```json
// GET <url>/master
{
  "directory" : {
    "fileA": {
      "foo": "bar"
    },
    "subDirectory": {
      "fileB": {
        "foo": "bar"
      }
    }
  },
  "file1": {
    "min": 1,
    "max": 10
  },
  "file2": [
    "item1",
    "item2",
    "item3"
  ]
}
```

### `GET /:version/path`

Optionally, the previous route can be called with an additional path into the content to retrieve specific data.

```json
// GET <url>/master/directory/fileA
{
  "foo": "bar"
}
```

### `PUT /:version/path`

The content of a directory or single file can be replaced using a PUT request. The body is expected to contain JSON data for all files and subdirectories or a file. The intended workflow is to query a path using `GET /:version/path`, make the desired changes to the data and send the whole data back via `PUT /:parentVersion/path`.

A new Git commit will be created and merged if necessary. The response will contain the hash of the new (merge) commit in the `Git-Commit-Hash` header. If the merge fails, an error will be returned.

#### Examples

The body to replace everything inside directory looks like this:

```json
// PUT <url>/master/directory
{
  "files": {
    "fileA": {
      "foo": "bar"
    },
    "subDirectory/fileB": {
        "foo": "bar"
      }
    }
  }
}
```

The body to replace a single file only looks like this:
```json
// PUT <url>/master/file1
{
  "fileContent" : {
    "min": 10,
    "max": 30
  }
}
```

Additional properties are:  
`author`: Will be used as commit author.  
`updateBranch`: The branch which should be updated to the new commit (default: "master").

## Development Setup

```bahs
npm install
REPO_URI=<repo-url> npm run watch
```

## Deployment

### Heroku/Dokku

The service is designed to be deployed using [Dokku](http://dokku.viewdocs.io/dokku/) and will probably also work with [Heroku](https://www.heroku.com/) and other compatible platforms.

### Dockerfile

The service contains a Dockerfile to start it directly with Docker.