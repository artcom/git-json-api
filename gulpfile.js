const gulp = require("gulp")
const nodemon = require("gulp-nodemon")
const path = require("path")
const spawn = require("child_process").spawn

const SOURCE_DIR = "./src"

let bunyan = null

gulp.task("watch", () =>
  nodemon({
    script: path.join(SOURCE_DIR, "main.js"),
    watch: SOURCE_DIR,
    stdout: false
  }).on("readable", function() {
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
