"use strict"

const gulp = require("gulp")
const babel = require("gulp-babel")
const nodemon = require("gulp-nodemon")
const path = require("path")
const spawn = require("child_process").spawn
const sourcemaps = require("gulp-sourcemaps")

const SOURCE_DIR = "./src"
const DIST_DIR = "./dist"

let bunyan = null

gulp.task("compile", () =>
  gulp.src(path.join(SOURCE_DIR, "**/*.js"))
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest(DIST_DIR))
)

gulp.task("watch", ["compile"], () =>
  nodemon({
    script: path.join(DIST_DIR, "main.js"),
    watch: SOURCE_DIR,
    tasks: ["compile"],
    stdout: false
  }).on("readable", function () {
    if (bunyan) {
      bunyan.kill()
    }

    bunyan = spawn("./node_modules/.bin/bunyan", [
      "--output", "short",
      "--color"
    ])

    bunyan.stdout.pipe(process.stdout)
    bunyan.stderr.pipe(process.stderr)

    this.stdout.pipe(bunyan.stdin)
    this.stderr.pipe(bunyan.stdin)
  })
)
