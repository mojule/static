'use strict';

var path = require('path');
var Components = require('@mojule/components');
var is = require('@mojule/is');
var Mmon = require('@mojule/mmon');
var Tree = require('@mojule/tree');
var utils = require('@mojule/utils');
var Vfs = require('@mojule/vfs');
var pify = require('pify');
var rimraf = require('rimraf');
var fs = require('fs');

var virtualize = pify(Vfs.virtualize);

Vfs.registerText('.mmon');

var expandRoutes = function expandRoutes(vfs, componentsApi) {
  var components = componentsApi.get();
  var getModel = componentsApi.getModel;


  var routingMmonFiles = vfs.findAll(function (current) {
    return current.nodeType() === 'file' && current.filename() === '_route.mmon';
  });

  routingMmonFiles.forEach(function (file) {
    var parent = file.getParent();
    var mmon = Mmon.parse(file.value().data.toString('utf8'));

    var config = file.siblings().find(function (current) {
      return current.nodeType() === 'file' && current.filename() === '_routes.json';
    });

    if (!config) throw new Error('_route.mmon requires a matching _routes.json');

    var _JSON$parse = JSON.parse(config.value().data.toString('utf8')),
        data = _JSON$parse.data,
        component = _JSON$parse.component,
        routeFrom = _JSON$parse.routeFrom;

    file.remove();
    config.remove();

    var model = getModel(data);

    if (!is.array(model)) throw new Error('Route data should be an array');

    model.forEach(function (item) {
      var currentTree = Tree(utils.clone(mmon));
      var componentNode = currentTree.find(function (current) {
        return current.getValue('name') === component;
      });

      var document = currentTree.find(function (current) {
        return current.getValue('name') === 'document';
      });

      if (document) {
        var _model = document.getValue('model');

        _model.title = item[routeFrom];

        document.setValue('model', _model);
      }

      componentNode.setValue('model', item);

      var routeName = utils.identifier(item[routeFrom]);
      var routeFolder = Vfs.createDirectory(routeName);

      parent.add(routeFolder);

      var itemTree = JSON.stringify(currentTree.get(), null, 2);
      var index = Vfs.createFile('index.json', itemTree);

      routeFolder.add(index);
    });
  });

  return vfs;
};

var createHtmlFiles = function createHtmlFiles(vfs, componentsApi) {
  var components = componentsApi.get();

  var mmonFiles = vfs.findAll(function (current) {
    return current.nodeType() === 'file' && (current.getValue('ext') === '.mmon' || current.filename() === 'index.json');
  });

  var linkMap = new Map();

  mmonFiles.forEach(function (mmonFile) {
    var _mmonFile$value = mmonFile.value(),
        nodeType = _mmonFile$value.nodeType,
        ext = _mmonFile$value.ext,
        filename = _mmonFile$value.filename,
        data = _mmonFile$value.data;

    var value = data.toString('utf8');

    var mmon = filename === 'index.json' ? JSON.parse(value) : Mmon.parse(value);
    var model = Tree(mmon);

    var document = model.find(function (current) {
      return current.getValue('name') === 'document';
    });

    var title = void 0;

    var _path$parse = path.parse(mmonFile.getParent().filename()),
        name = _path$parse.name;

    var slug = name;

    if (document) {
      var _model2 = document.getValue('model');

      if (_model2.title) title = _model2.title;
    }

    if (!title) {
      title = slug;
    }

    var uri = '/' + path.posix.relative(vfs.getPath(), mmonFile.getParent().getPath());

    var isHome = uri === '/';

    var depth = mmonFile.ancestors().length;

    var parent = '';

    if (depth > 2) {
      var parentFilename = mmonFile.getParent().getParent().filename();

      var _path$parse2 = path.parse(parentFilename),
          _name = _path$parse2.name;

      parent = _name;
    }

    linkMap.set(uri, { slug: slug, title: title, uri: uri, isHome: isHome, depth: depth, parent: parent });

    var meta = { model: model, slug: slug, title: title, uri: uri, isHome: isHome, depth: depth, parent: parent };

    mmonFile.meta(meta);
  });

  var links = Array.from(linkMap.values()).filter(function (l) {
    return l.depth <= 2;
  });
  var secondary = Array.from(linkMap.values()).filter(function (l) {
    return l.depth > 2;
  });

  var compare = function compare(a, b) {
    if (a.title > b.title) return -1;

    if (a.title < b.title) return 1;

    return 0;
  };

  links.sort(compare).sort(function (a, b) {
    return a.isHome ? -1 : 1;
  });
  secondary.sort(compare);

  var root = vfs.getRoot();

  root.setValue('filename', 'static');

  mmonFiles.forEach(function (mmonFile) {
    var parent = mmonFile.getParent();
    var meta = mmonFile.meta();
    var model = meta.model,
        title = meta.title,
        slug = meta.slug,
        depth = meta.depth;


    var header = model.find(function (current) {
      return current.getValue('name') === 'header';
    });

    if (header) {
      var _model3 = header.getValue('model');
      var linksModel = { links: links };

      var secondaryLinks = secondary.filter(function (l) {
        return l.parent === slug || l.depth === depth;
      });

      if (secondaryLinks.length > 0) linksModel['secondary-links'] = secondaryLinks;

      Object.assign(_model3, linksModel);

      header.setValue('model', _model3);
    }

    var dom = componentsApi.dom(model);

    var _path$parse3 = path.parse(mmonFile.getValue('filename')),
        name = _path$parse3.name;

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
      return expandRoutes(vfs, api);
    }).then(function (vfs) {
      return createHtmlFiles(vfs, api);
    }).then(function (vfs) {
      actualize(vfs, outpath, callback);
    }).then(function () {
      fs.writeFileSync('log.txt', Tree.getLog().join('\n'), 'utf8');
    }).catch(callback);
  });
};

module.exports = Static;