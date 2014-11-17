//  CONFIG GULP:
var gulp = require('gulp');
var bower = require('bower');

gulp.task('bower', function(cb){
  bower.commands.install([], {save: true}, {})
    .on('end', function(installed){
      cb(); // notify gulp that this task is finished
    });
});

var path = require("path"),
	pkg = require("./package.json");
 
 
//  PLUG-INS:
var jshint = require('gulp-jshint');

// TASKS:

// JSHint 
gulp.task('jshint', function() {
  gulp.src('./src/scripts/canada-earthquakes.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});


gulp.task('deploy', function() {
	gulp.src('./**', { base: './src' })
	.pipe(gulp.dest('./deploy'));
	gulp.task(['getlibs']);
});

gulp.task('getlibs', function() {
	gulp.src('./bower_components/datejs/build/date.js')
	.pipe(gulp.dest('./src/scripts'));
	
	gulp.src('./bower_components/jquery/dist/jquery.js')
	.pipe(gulp.dest('./src/scripts'));
	
	/* TODO: python build.py full first to create the proper version of this.
	more at: http://docs.openlayers.org/library/deploying.html
	gulp.src('./bower_components/openlayers/lib/OpenLayers.js')
	.pipe(gulp.dest('./src/scripts'));
	*/
});

//START-UP DEFAULT ("$ gulp")
gulp.task('default', ['jshint']);

