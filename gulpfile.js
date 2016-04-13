const gulp = require("gulp")
const babel = require("gulp-babel")
const watch = require("gulp-watch")

const SOURCES = "src/*.js"
const DIST_DIR = "dist"

gulp.task("default", () =>
  gulp.src(SOURCES)
    .pipe(babel())
    .pipe(gulp.dest(DIST_DIR))
)

gulp.task("watch", () =>
gulp.src(SOURCES)
  .pipe(watch(SOURCES))
  .pipe(babel())
  .pipe(gulp.dest(DIST_DIR))
)
