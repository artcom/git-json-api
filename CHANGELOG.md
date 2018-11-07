# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.0.0] - 2018-11-07
### Removed
- `GET /latest` (use `GET /master` or `GET /master/path` instead and read the version from the `Git-Commit-Hash` header)
- update internal dependencies

### Changed
- `GET /:version` and `GET /:version/path` support using `master` for the version parameter
- all routes return the actual version in the `Git-Commit-Hash` header

## [0.1.0] - 2016-11-17
### Added
- `GET /latest`
- `GET /:version`
- `GET /:version/path`
- `POST /:version/path`
