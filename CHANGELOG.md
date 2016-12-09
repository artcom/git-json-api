# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]
### Removed
- `GET /latest` (use `GET /master` or `GET /master/path` instead and read the version from the `ETag` header)

### Changed
- `GET /:version` and `GET /:version/path` support using `master` for the version parameter
- all routes return the actual version in the `ETag` header

## [0.1.0] - 2016-11-17
### Added
- `GET /latest`
- `GET /:version`
- `GET /:version/path`
- `POST /:version/path`