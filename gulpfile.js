/*jshint node: true */

var gulp = require("gulp"),
    gutil = require("gulp-util"),
    jade = require("gulp-jade"),
    jscs = require("gulp-jscs"),
    stylishJscs = require("gulp-jscs-stylish"),
    jshint = require("gulp-jshint"),
    plumber = require("gulp-plumber"),
    rename = require("gulp-rename"),
    rimraf = require("gulp-rimraf"),
    shell = require("gulp-shell"),
    stylus = require("gulp-stylus"),
    uglify = require("gulp-uglify"),
    stylishJshint = require("jshint-stylish"),
    bower = require("gulp-bower"),
    _ = require("underscore");

(function () {
    "use strict";

    var gulpSrc = gulp.src;
    gulp.src = function () {
        return gulpSrc.apply(gulp, arguments)
            .pipe(plumber(function (error) {
                gutil.log(gutil.colors.red("Error (" + error.plugin + "): " + error.message));
                this.emit("end");
            }));
    };
}());

gulp.task("jade", function () {
    "use strict";

    return gulp.src("src/jade/*.jade")
        .pipe(jade())
        .pipe(gulp.dest("./build/site"));
});

gulp.task("stylus", function () {
    "use strict";

    return gulp.src("src/styl/**/*.styl")
        .pipe(stylus({
            compress: true
        }))
        .pipe(gulp.dest("./build/site"));
});

gulp.task("uglify", function () {
    "use strict";

    var dest = _.bind(gulp.dest, gulp, "build/site");

    return gulp.src("src/js/index.js")
        .pipe(dest())
        .pipe(uglify())
        .pipe(rename("index.min.js"))
        .pipe(dest());
});

gulp.task("lint", function () {
    "use strict";

    return gulp.src([
        "src/js/**/*.js",
        "gulpfile.js"
    ])
        .pipe(jshint())
        .pipe(jshint.reporter(stylishJshint))
        .pipe(jshint.reporter("fail"));
});

gulp.task("style", function () {
    "use strict";

    return gulp.src([
        "src/js/**/*.js",
        "gulpfile.js"
    ])
        .pipe(jscs())
        .pipe(stylishJscs());
});

gulp.task("assets", function () {
    "use strict";

    gulp.src("src/assets/**/*")
        .pipe(gulp.dest("./build/site/assets"));
});

gulp.task("clean", function () {
    "use strict";

    return gulp.src("./build/**", { read: false })
        .pipe(rimraf());
});

gulp.task("bower", function () {
    "use strict";

    return bower()
        .pipe(gulp.dest("./build/site/bower_components"));
});

gulp.task("default", [
    "lint",
    "style",
    "stylus",
    "uglify",
    "jade",
    "assets",
    "bower"
]);

gulp.task("serve", function () {
    "use strict";

    var host = process.env.CLIQUE_HOST || "localhost",
        port = process.env.CLIQUE_PORT || 3000;

    return gulp.src("")
        .pipe(shell(["tangelo",
                     "--host", host,
                     "--port", port,
                     "--root", "build/site",
                     "--config", "tangelo-config.yaml"].join(" ")));
});
