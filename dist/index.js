'use strict';

var path = require('path');
var Components = require('@mojule/components');
var is = require('@mojule/is');
var Mmon = require('@mojule/mmon');
var Tree = require('@mojule/tree');
var Vfs = require('@mojule/vfs');
var pify = require('pify');
var rimraf = require('rimraf');

var virtualize = pify(Vfs.virtualize);

var createHtmlFiles = function createHtmlFiles(vfs, componentsApi) {
  var components = componentsApi.get();

  var mmonFiles = vfs.findAll(function (current) {
    return current.nodeType() === 'file' && current.getValue('ext') === '.mmon';
  });

  var links = [];

  mmonFiles.forEach(function (mmonFile) {
    var _mmonFile$value = mmonFile.value(),
        nodeType = _mmonFile$value.nodeType,
        ext = _mmonFile$value.ext,
        filename = _mmonFile$value.filename,
        data = _mmonFile$value.data;

    var value = data.toString('utf8');
    var mmon = Mmon.parse(value);
    var model = Tree(mmon);

    var document = model.find(function (current) {
      return current.getValue('name') === 'document';
    });

    var title = void 0;

    if (document) {
      var _model = document.getValue('model');

      if (_model.title) title = _model.title;
    }

    if (!title) {
      var _path$parse = path.parse(filename),
          name = _path$parse.name;

      title = name;
    }

    var uri = '/' + path.posix.relative(vfs.getPath(), mmonFile.getParent().getPath());

    var isHome = uri === '/';
    var meta = { model: model, title: title, uri: uri, isHome: isHome };

    links.push({ title: title, uri: uri, isHome: isHome });

    mmonFile.meta(meta);
  });

  links.sort(function (a, b) {
    return a.isHome ? -1 : 1;
  });

  var root = vfs.getRoot();

  root.setValue('filename', 'static');

  mmonFiles.forEach(function (mmonFile) {
    var parent = mmonFile.getParent();
    var meta = mmonFile.meta();
    var model = meta.model;


    var header = model.find(function (current) {
      return current.getValue('name') === 'header';
    });

    if (header) {
      var _model2 = header.getValue('model');

      Object.assign(_model2, { links: links });

      header.setValue('model', _model2);
    }

    var dom = componentsApi.dom(model);

    var _path$parse2 = path.parse(mmonFile.getValue('filename')),
        name = _path$parse2.name;

    var htmlName = name + '.html';
    var newFile = Vfs.createFile(htmlName, dom.stringify({ pretty: true }));

    parent.append(newFile);
    mmonFile.remove();
  });

  return vfs;
};

var actualize = function actualize(vfs, outpath, callback) {
  vfs.actualize(outpath, function (err) {
    if (err && err.code === 'EEXIST') {
      rimraf(err.path, function (err) {
        if (err) callback(err);

        actualize(vfs, outpath, callback);
      });

      return;
    }

    callback(err);
  });
};

// read the routes first
// generate a component for the routes
var Static = function Static(inpath, outpath) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : function (err) {
    if (err) throw err;
  };

  if (is.function(options)) {
    callback = options;
    options = {};
  }

  var componentsPath = path.join(inpath, './components');
  var routesPath = path.join(inpath, './routes');

  Components.read(componentsPath, function (err, api) {
    if (err) return callback(err);

    return virtualize(routesPath).then(function (vfs) {
      return createHtmlFiles(vfs, api);
    }).then(function (vfs) {
      actualize(vfs, outpath, callback);
    });
  });
};

module.exports = Static;