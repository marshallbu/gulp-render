/**
 * gulp-render-react
 * https://github.com/koistya/gulp-render
 *
 * Copyright (c) 2014 Konstantin Tarkus
 * Licensed under the MIT license
 */

/*eslint-disable max-statements, no-underscore-dangle, max-depth */

'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs');
var React = require('react');
var babel = require('babel');
var hyphenate = require('react/lib/hyphenate');
var template = require('lodash/string/template');
var extend = require('lodash/object/extend');
var PluginError = gutil.PluginError;
var Module = module.constructor;

// Constants
var PLUGIN_NAME = 'gulp-render-react';

/**
 * Check if Page component has a layout property; and if yes, wrap the page
 * into the specified layout, then render to a string.
 */
function renderToString(page) {
    var layout = null, child = null, props = {};
    while ((layout = page.layout || (page.defaultProps && page.defaultProps.layout))) {
        child = React.createElement(page, props, child);
        extend(props, page.defaultProps);
        React.renderToString(React.createElement(page, props, child));
        page = layout;
    }
    return React.renderToString(React.createElement(page, props, child));
}

/**
 * Just produce static markup without data-react-* attributes
 * http://facebook.github.io/react/docs/top-level-api.html#react.rendertostaticmarkup
 */
function renderToStaticMarkup(page) {
    return React.renderToStaticMarkup(React.createElement(page));
}

// Plugin level function (dealing with files)
function Plugin(options) {
    var babelOptions,
        originalJsTransform;

    options = options || {};

    babelOptions = options.babelOptions || {};

    if (options.template && options.template.indexOf('<') === -1) {
        options.template = fs.readFileSync(options.template, {encoding: 'utf8'});
    }

    originalJsTransform = require.extensions['.js'];

    var reactTransform = function(module, filename) {
        var src;
        if (filename.indexOf('node_modules') === -1) {
            src = fs.readFileSync(filename, {encoding: 'utf8'});
            src = babel.transform(src, babelOptions);
            module._compile(src, filename);
        } else {
            originalJsTransform(module, filename);
        }
    };

    require.extensions['.js'] = reactTransform;
    require.extensions['.jsx'] = reactTransform;

    // Creates a stream through which each file will pass
    var stream = through.obj(function(file, enc, cb) {
        var contents, m, Component, markup, compiled, data, filename;
        if (!file.isNull()) {

            if (file.isStream()) {
                this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
                return cb();
            }

            if (file.isBuffer()) {

                try {
                    contents = file.contents.toString('utf8');
                    contents = babel.transform(contents, babelOptions);

                    m = new Module();
                    m.id = file.path;
                    m.filename = file.path;
                    m.paths = module.paths.slice(1);
                    m._compile(contents.code, file.path);
                    Component = m.exports;

                    markup = options.staticMarkup ? renderToStaticMarkup(Component) : renderToString(Component);

                    if (options.template) {
                        compiled = template(options.template);
                        data = extend({}, (typeof options.data === 'function' ? options.data(file) : options.data));
                        data.body = markup;

                        // Set default values to avoid null-reference exceptions
                        data.title = data.title || '';
                        data.description = data.description || '';
                        data.keywords = data.keywords || '';

                        markup = compiled(data);
                    }

                    file.contents = new Buffer(markup);
                    filename = gutil.replaceExtension(file.path, '.html');

                    if (typeof options.hyphenate === 'undefined' || options.hyphenate) {
                        filename = hyphenate(path.basename(filename));
                        filename = filename.lastIndexOf('-', 0) === 0 ? filename.substring(1) : filename;
                        filename = path.join(path.dirname(file.path), filename);
                    }

                    file.path = filename;
                } catch (err) {
                    this.emit('error', new PluginError(PLUGIN_NAME, err));
                    return cb();
                }
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
