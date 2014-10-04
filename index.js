/*!
 * gulp-render | https://github.com/koistya/gulp-render
 *
 * Copyright (c) Konstantin Tarkus (@koistya).  See LICENSE.txt
 */

'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var fs = require('fs');
var _ = require('lodash');
var React = require('react');
var react = require('react-tools');
var template = _.template;
var PluginError = gutil.PluginError;
var Module = module.constructor;

// Constants
var PLUGIN_NAME = 'gulp-render';

// Plugin level function (dealing with files)
function Plugin(options) {

  options = options || {};

  var reactOptions = {harmony: typeof options.harmony === 'undefined' ? true : options.harmony};

  if (options.template && options.template.indexOf('<') === -1) {
    options.template = fs.readFileSync(options.template, {encoding: 'utf8'});
  }

  var originalJsTransform = require.extensions['.js'];

  var reactTransform = function(module, filename) {
    if (filename.indexOf('node_modules') === -1) {
      var src = fs.readFileSync(filename, {encoding: 'utf8'});
      src = react.transform(src, reactOptions);
      module._compile(src, filename);
    } else {
      originalJsTransform(module, filename);
    }
  };

  require.extensions['.js'] = reactTransform;
  require.extensions['.jsx'] = reactTransform;

  // Creates a stream through which each file will pass
  var stream = through.obj(function(file, enc, cb) {

    if (!file.isNull()) {

      if (file.isStream()) {
        this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
        return cb();
      }

      if (file.isBuffer()) {

        var contents = file.contents.toString('utf8');
        contents = react.transform(contents, reactOptions);
        var m = new Module();
        m.id = file.path;
        m.filename = file.path;
        m.paths = module.paths.slice(1);
        m._compile(contents, file.path);
        var Component = m.exports;
        var markup = React.renderComponentToString(new Component());

        if (options.template) {
          var data = Component.defaultProps || {};
          data.body = markup;
          data.title = data.title || '';
          data.description = data.description || '';
          markup = template(options.template, data);
        }

        file.contents = new Buffer(markup);
        file.path = gutil.replaceExtension(file.path, '.html');
      }

    }

    // Make sure the file goes through the next gulp plugin
    this.push(file);
    // Tell the stream engine that we are done with this file
    return cb();
  });

  // Return the file stream
  return stream;
}

module.exports = Plugin;