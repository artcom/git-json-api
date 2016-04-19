const gulp = require("gulp")
const babel = require("gulp-babel")
const nodemon = require("gulp-nodemon")
const path = require("path")

const SOURCE_DIR = "./src"
const DIST_DIR = "./dist"

gulp.task("compile", () =>
  gulp.src(path.join(SOURCE_DIR, "*.js"))
    .pipe(babel())
    .pipe(gulp.dest(DIST_DIR))
)

gulp.task("watch", ["compile"], () => {
  nodemon({
    script: path.join(DIST_DIR, "main.js"),
    watch: SOURCE_DIR,
    task: ["compile"]
  })
})
