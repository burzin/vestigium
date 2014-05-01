var fs = require('fs'),
    config = require("./config/default.json"),
    mysql = require('mysql'),
    bodyParser = require("body-parser"),
    Express = require('express'),
    controllers,
    log = console.log,
    app = new Express(),
    pool;
function init(){
    try{
        pool = mysql.createPool(config.database);
    }catch(e){
        console.log('error connecting to ' + config.database.host);
        throw e;
    }
    if(!fs.existsSync('./build')){
        fs.mkdirSync('./build');
    }
    controllers = require('./lib/controllers')({ config: config, pool: pool, log: log });
    controllers.buildAll(function(){
        controllers.buildLoader();
    });
}
init();
app.use(Express.static('./public'));
app.use(bodyParser());
app.get('/tms/:env/main.js', controllers.controllerLoader);
app.get('/tms/:env/:build/main.js', controllers.controllerScript);
app.post('/responder', controllers.controllerResponder);
app.post('/tms/:env/ver', controllers.controllerVersion);
app.get('/build/:env', controllers.controllerBuild);
app.get('/tms/help', controllers.controllerHelp);
app.listen(config.appPort);