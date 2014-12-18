function init(){
    var fs = require('fs'),
        config = require('./config/default.json'),
        mysql = require('mysql'),
        bodyParser = require("body-parser"),
        Express = require('express'),
        controllers,
        log = console.log,
        app = new Express(),
        pool = mysql.createPool(config.database);
    controllers = require('./lib/controllers')({ config: config, pool: pool, log: log });
    app.disable('etag');
    app.use(Express.static('./public'));
    app.use(bodyParser());
    app.all('*', function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    }).options('*', function(req, res, next){
        res.end();
    });
    app.get('/tagjs/:env/main.js', controllers.controllerScript);
    app.post('/responder', controllers.controllerResponder);
    app.post('/private_tagjs/:env/ver', controllers.controllerVersion);
    app.get('/build/:env', controllers.controllerBuild);
    app.get('/private_tagjs/help', controllers.controllerHelp);
    app.listen(config.appPort);
    return {
        app: app,
        controllers: controllers,
        init: init,
        config: config
    };
}
module.exports = init();