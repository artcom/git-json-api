# Git JSON API

A JSON API to serve the contents of JSON files from a Git repo. All files in the repo are expected to be JSON files with a `.json` extension.

## Configuration

### Environment Variables

The service can be configured using these environment variables:

* `REPO_URI` _(required)_ URI of the Git repository
* `SIGNATURE_MAIL` _(optional)_ E-mail address used for generated commits

## API

### `GET /:version`

Returns the contents of the repo at the given version as a single JSON object.

Version can either be a Git commit hash or a reference. The response will contain the Git commit hash in the `Git-Commit-Hash` header.

The returned object contains the contents of every file in the root of the repo in a property named like the file (without extension). For every directory, it contains another object with the same structure.

If a repo contains `file1.json`, `file2.json`, `directory/fileA.json` and `directory/subDirectory/fileB.json`, the response would be structured as follows:

```json
{
  "directory" : {
    "fileA": {
      "foo": "bar"
    },
    "subDirectory": {
      "fileB": {
        "spam": "eggs"
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

Optionally, the previous route can be called with an additional path to a file or directory in the repo to retrieve an excerpt of the data. In the above example, `/:version/directory/fileA` would return:

```json
{
  "foo": "bar"
}
```

### `PUT /:version/path`

The content of a directory or single file can be replaced using a PUT request. The body is expected to contain JSON data for all files and subdirectories or a file. The intended workflow is to query a path using `GET /:version/path`, make the desired changes to the data and send the whole data back via `POST /:version/path`.

A new Git commit will be created and merged if necessary. The response will contain the hash of the new (merge) commit in the `Git-Commit-Hash` header. If the merge fails, an error will be returned.

#### Examples

Directory replacement:

```json
// PUT <url>/master/directory
{
  "files": {
    "fileA": {
      "foo": "baz"
    },
    "subDirectory": {
      "fileB": {
        "spam": "apples"
      }
    }
  }
}
```

Single file replacement:
```json
// PUT <url>/master/file1
{
  "fileContent" : {
    "min": 10,
    "max": 30
  }
}
```

## Development Setup

```bash
npm install
REPO_URI=<repo-url> npm run watch
```

## Deployment

The service is designed to be deployed using [Dokku](http://dokku.viewdocs.io/dokku/) and will probably also work with [Heroku](https://www.heroku.com/) and other compatible platforms.
