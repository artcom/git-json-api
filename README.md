# Git JSON API

A JSON API to serve the contents of JSON5 files from a Git repo. All files in the repo are expected to be JSON5 files with a `.json` extension.

## Usage

The API has the following endpoints:

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
REPO=<repo-url> gulp watch
```

## Deployment

**NOTE** Installing the `nodegit` dependency on Dokku requires some tweaking, namely setting the environment variables `BUILD_ONLY=true` and `NPM_CONFIG_PRODUCTION=false`.

```bash
# create app
ssh dokku@<server> apps:create git-json-api

# make sure nodegit will be build from source
ssh dokku@<server> config:set git-json-api BUILD_ONLY=true NPM_CONFIG_PRODUCTION=false

# configure repo and signature
ssh dokku@<server> config:set git-json-api REPO=<repo-url>       # repository to be served
ssh dokku@<server> config:set git-json-api SIGNATURE_NAME=<name> # name for generated commits
ssh dokku@<server> config:set git-json-api SIGNATURE_MAIL=<mail> # e-mail address for generated commits

# add dokku server as remote
git remote add <environment> dokku@<server>:git-json-api

# deploy to server
git push <environment> master
```
