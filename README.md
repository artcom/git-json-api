# Git JSON API

A JSON API to serve the contents of JSON5 files from a Git repo. All files in the repo are expected to be JSON5 files with a `.json` extension.

## Configuration

### Environment Variables

The service can be configured using these environment variables:

* `REPO_URI` _(required)_ URI of the Git repository
* `SIGNATURE_NAME` _(optional)_ Name used for generated commits
* `SIGNATURE_MAIL` _(optional)_ E-mail address used for generated commits

### schema.json

The Git repo must contain a file named `schema.json` in the root directory. It describes the directory structure of the repo by defining a list of glob patterns. Any file in the repository should be matched by one of the glob patterns.

#### Example

```json
{
  "files": [
    "some-directory/*",
    "other-directory/*/file"
  ]
}
```

In this example, the repo could contain files like `some-directory/foo.json`, `some-directory/foo.json`, `other-directory/a/file.json` or `other-directory/b/file.json`.

## API

### `GET /latest`

Returns the latest version of the data in the repo (i.e. the latest commit on the master branch):

```json
{
  "version": "d1b55c41589a75be0d901fe6a04ea8ad3479b673"
}
```

### `GET /:version`

Returns the contents of the repo as a single JSON object. The object contains the contents of every file in the root of the repo in a property named like the file (without extension). For every directory, it contains another object with the same structure.

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

### `POST /:version/path`

The content of a directory can be modified using a POST request. The body is expected to contain JSON data for all files and subdirectories. The intended workflow is to query a path using `GET /:version/path`, make the desired changes to the data and send the whole data back via `POST /:version/path`. A new git commit will be created and merged if necessary. It the merge fails, an error will be returned.

## Development Setup

```bash
npm install
npm install --global gulp-cli
REPO_URI=<repo-url> gulp watch
```

## Deployment

The service is designed to be deployed using [Dokku](http://dokku.viewdocs.io/dokku/) and will probably also work with [Heroku](https://www.heroku.com/) and other compatible platforms.

**NOTE:** Installing the `nodegit` dependency on Dokku requires some tweaking, namely setting the environment variables `BUILD_ONLY=true` and `NPM_CONFIG_PRODUCTION=false`.
