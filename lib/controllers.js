var https = require('https'),
    mysql = require('mysql'),
    check = require('syntax-error'),
    XXHash = require('xxhash'),
    async = require('async'),
    fs = require('fs'),
    minify = require('minify'),
    markdown = require('markdown').markdown,
    json = {'content-type': 'application/json'},
    text = {'content-type': 'text/plain'},
    js = {'content-type': 'text/javascript'},
    html = {'content-type': 'text/html'},
    environments,
    boundary = '/***BOUNDARY***/',
    config,
    seed = 0xCAFEBABE,
    controllers,
    host = require('os').hostname(),
    log,
    tagErrors = {},
    pool,
    q = {
        revertState1: "delete from configuration where (select count(0) from configurationHistoryDetail " +
        " where historyId = ':historyId' and env = ':env') > 0 and env = ':env';",
        revertState2: "insert into configuration select id, d.env, repoid, url, path, ref, d.timestamp, h.historyId, h.comment, d.enabled, version, buildOutput, parentId, builtOn " +
        " from configurationHistory h inner join configurationHistoryDetail d on d.historyId = h.historyId where h.historyId = ':historyId' and h.env = ':env';",
        deleteConfig: "delete from configuration where id = ':id';",
        getConfig: "select id, c.env, repoid, url, path, ref, c.timestamp, c.historyId, c.comment, enabled, " +
        " c.version, c.buildOutput, c.parentId, c.builtOn from configuration c " +
        " where c.env = ':env' order by c.repoid, c.ref, c.path;",
        updateHistory1: "insert into configurationHistory (historyId, timestamp, comment, env) " +
        " values (':historyId', :timestamp, ':comment', ':env');",
        updateHistory2: "insert into configurationHistoryDetail " +
        " select UUID() as historyDetailId, env, repoid, url, path, ref, timestamp, ':historyId' as historyId, id, enabled, ':version', ':buildOutput', parentId, builtOn " +
        " from configuration where env = ':env';",
        updateHistory3: "update configuration set historyId = ':historyId', comment = ':comment' where env = ':env';",
        updateConfig: "update configuration set env = ':env', repoid = ':repoid', " +
        " url = ':url', path = ':path', ref = ':ref', timestamp = :timestamp, " +
        " enabled = :enabled, version = '-1', buildOutput = '' where id = ':id';",
        insertConfig: "insert into configuration (id, env, repoid, url, path, ref, timestamp, historyId, comment, enabled, version, buildOutput, parentId) values " +
        " (':id', ':env', ':repoid', ':url', ':path', ':ref', :timestamp, '', '', :enabled, ':version', ':buildOutput', ':id');",
        getHistoryOverview: "select historyId, timestamp, comment, env " +
        " from configurationHistory where env = ':env' order by timestamp desc;",
        getHistory: "select historyDetailId, id, h.env, repoid, url, path, ref, d.timestamp, comment, h.historyId, h.timestamp as snapdate, d.enabled, version, buildOutput, parentId, builtOn " +
        " from configurationHistory h inner join configurationHistoryDetail d on d.historyId = h.historyId " +
        " where d.historyId = ':historyId';",
        getBuild: "select buildOutput from configuration where env = ':env' limit 1;",
        updateBuildData1: "update configuration set builtOn = ':builtOn', version = ':ver', buildOutput = ':buildOutput' where env = ':env';",
        updateBuildData2: "select timestamp from configurationHistory where env = ':env' ",
        copyConfig1: "select count(0) from configuration where env = ':targetEnv' and id = ':id' having count(0) > 0;",
        copyConfig2: "delete from configuration where env = ':targetEnv' and (parentId = ':id' or id = ':id');",
        copyConfig3: "insert into configuration " +
        " select ':newId' as id, ':targetEnv' as env, repoid, url, path, ref, timestamp, historyId, comment, " +
        " enabled, '0' as version, '' as buildOutput, parentId, 0 as builtOn " +
        " from configuration where env = ':srcEnv' and (parentId = ':id' or id = ':id');"
    },
    buildCache = {},
    loaderScripts = {},
    scriptVersions = {},
    connections = 0;
function getConnection(callback){
    connections++;
    pool.getConnection(callback);
}
function releaseConnection(db){
    connections--;
    db.release();
}
function createHash(src){
    return XXHash.hash(new Buffer(src), seed);
}
function isArray(value) {
    return value && typeof value === 'object' &&
        typeof value.length === 'number' &&
        !(value.propertyIsEnumerable('length'));
}
function errOutput(value){
    if(!value){
        return undefined;
    }
    return isArray(value) ? value : [value];
}
function getGitRepoInfo(repoName, callback){
    var options = {
        hostname: config.git.host,
        port: config.git.port,
        path: config.git.getRepoInfoPath.
            replace('{repoName}', encodeURIComponent(repoName)),
        method: 'get',
        headers: {"PRIVATE-TOKEN": config.git.token}
    };
    var req = https.request(options, function(res) {
        var data = '',
            err;
        res.on('data', function(chunk){
            data += chunk;
        });
        res.on('end', function(){
            try{
                callback(err, JSON.parse(data));
            }catch(e){
                callback(e);
            }
        });
    });
    req.on('error', function(e) {
        callback(e);
    });
    req.end();
}
function getGitContents(repoName, path, ref, callback){
    if(config.git.type === 'gitlabs'){
        getGitRepoInfo(repoName, function(err, data){
            if(err){
                callback(err);
            }
            getGitLabsContents(data.id, path, ref, callback);
        });
    }
}
function getGitLabsContents(id, path, ref, callback){
    ref = ref ? '&ref=' + ref : '';
    var options = {
        hostname: config.git.host,
        port: config.git.port,
        path: config.git.readApiPath.
            replace('{id}', id).
            replace('{path}', path).
            replace('{ref}', ref),
        method: 'get',
        headers: {"PRIVATE-TOKEN": config.git.token}
    };
    var req = https.request(options, function(res) {
        var data = '',
            err;
        res.on('data', function(chunk){
            data += chunk;
        });
        res.on('end', function(){
            try{
                data = JSON.parse(data);
                data.id = id;
                data.ref = ref;
                data.path = path;
            }catch(e){
                err = e;
            }
            callback(err, data);
        });
    });
    req.on('error', function(e) {
        callback(e);
    });
    req.end();
}
function checkEnv(env, req, res){
    if(environments.indexOf(env) === -1){
        res.header(text).
        status(400).
        send('Unknown environment.');
        return false;
    }
    return true;
}
function buildMainScript(env, output, callback){
    var content = [],
        procs = [],
        errors = [],
        ver = '0';
        scriptVersions[env] = scriptVersions[env] || { version: '0' };
    getConnection(function(err, db){
        if(err){
            return callback(err);
        }
        db.query(parmFormat(q.getConfig, {env: env}), function(err, rows, fields){
            // id, env, repoid, url, path, ref, timestamp
            if(err){
                return callback(err);
            }
            releaseConnection(db);
            rows.forEach(function(item){
                procs.push(function(done){
                    getGitContents(item.repoid, item.path, item.ref, function(err, res){
                        if(err){
                            tagErrors[item.id] = err;
                            errors.push('API Error ' + err.toString() + ' PK:' + item.id);
                            return done();
                        }
                        var sErr,
                            src,
                            ref = item.ref.replace('&ref=',''),
                            srcRef = item.url + '/' + res.path + '#' + ref + ' PK:' + item.id;
                        if(res.message){
                            errors.push(res.message + ' ' + srcRef);
                            return done();
                        }
                        ver = createHash(ver + res.commit_id);
                        src = new Buffer(res.content, res.encoding).toString();
                        sErr = check(src, srcRef);
                        if(sErr){
                            tagErrors[item.id] = sErr;
                            errors.push(new Error('Syntax Error: ' + sErr).toString());
                            return done();
                        }
                        tagErrors[item.id] = undefined;
                        if(res.size > 0 && item.enabled === 1){
                            // make comment for code
                            content.push(makeComment(item, ref, res));
                            // check for syntax error, if error comment out error code and present explanation  
                            content.push(src);
                        }
                        done();
                    });
                });
            });
            // builds must come in order to ensure consistent hashing
            async.waterfall(procs, buildFiles);
        });
    });
    function commentCode(sErr, src){
        return '// Syntax Error \n//' + sErr.toString().replace(/\n/g,'\n//') + '\n//\n' +
        '//' + src.split('\n').join('\n//') + '\n';
    }
    function makeComment(item, ref, res){
        return '\n/*' +
        '\n\tpk: ' + item.id +
        '\n\turl: ' + item.url +
        '\n\trepoid: ' + item.repoid +
        '\n\tref: ' + ref +
        '\n\tpath: ' + item.path +
        '\n\tcommit_id: ' + res.commit_id +
        '\n\tblob_id:' + res.blob_id + '\n*/\n';
    }
    function buildFiles(){
        // if there were any errors during build, stop
        if(errors.length > 0){
            return callback(errors);
        }
        fs.readFile('./lib/main.js', function(err, data){
            if(err){
                callback(err);
                return;
            }
            var hash = ver,
                buildId = env,
                build = data.toString().replace(boundary, content.join('\n'));
            minify.optimizeData({
                ext: '.js',
                data: build
            }, function(error, data) {
                if(config.minify.indexOf(env) !== -1){
                    build = data;
                }
                build = '//' + hash + ' ' + env + '\n' + build;
                if(output){
                    fs.writeFile('./build/' + env + '.js', build, function(err){
                        if(err){
                            callback(err);
                        }
                        buildCache[env] = {
                            hash: hash.toString(),
                            build: build,
                            version: ver
                        };
                        scriptVersions[env].version = ver;
                        updateBuildData(env, buildCache[env], function(){
                            callback(errors.length > 0 ? errors : undefined, buildCache[env]);
                        });
                    });
                }else{
                    callback(errors.length > 0 ? errors : undefined, {hash: hash.toString(), build: build, version: ver});
                }
            });
        });
    }
}
function buildAll(callback){
    var procs = [];
    environments.forEach(function(item){
        procs.push(function(done){
            buildMainScript(item, true, function(err){
                if(err){
                    log('An error occurred while building', item, err);
                }
                done();
            });
        });
    });
    async.parallel(procs, function(){
        if(typeof callback === 'function'){callback();}
    });
}
function copyTag(req, res){
    getConnection(function(err, db){
        db.query(parmFormat(q.copyConfig1, req.body), function(err, rows, fields){
            sendDbError(res, err, db);
            req.body.newId = rows.length !== 0 ? req.body.id : createUUID();
            db.query(parmFormat(q.copyConfig2, req.body), function(err, rows, fields){
                sendDbError(res, err, db);
                db.query(parmFormat(q.copyConfig3, req.body), function(err, rows, fields){
                    sendDbError(res, err, db);
                    releaseConnection(db);
                    updateHistory(req.body.comment, req.body.targetEnv, function(err){
                        res.header(json).
                        send({
                            success: err === undefined,
                            err: errOutput(err)
                        });
                    });
                });
            });
        });
    });
}
function createTag(req, res){
    getConnection(function(err, db){
        req.body.inputs.timestamp = new Date().getTime();
        db.query(parmFormat(q.insertConfig, req.body.inputs), function(err, rows, fields){
            sendDbError(res, err, db);
            releaseConnection(db);
            updateHistory(req.body.inputs.comment, req.body.inputs.env, function(err){
                res.header(json).
                status(err === undefined ? 200 : 500).
                send({
                    success: err === undefined,
                    message: errOutput(err)
                });
            });
        });
    });
}
function updateTag(req, res){
    getConnection(function(err, db){
        sendDbError(res, err, db);
        req.body.inputs.timestamp = new Date().getTime();
        db.query(parmFormat(q.updateConfig, req.body.inputs), function(err, rows, fields){
            sendDbError(res, err, db);
            releaseConnection(db);
            updateHistory(req.body.inputs.comment, req.body.inputs.env, function(err){
                res.header(json).
                status(err === undefined ? 200 : 500).
                send({
                    success: err === undefined,
                    message: err === undefined ? 'Build Successful' : errOutput(err.toString())
                });
            });
        });
    });
}
function deleteTag(req, res){
    getConnection(function(err, db){
        db.query(parmFormat(q.deleteConfig, {id: req.body.id}), function(err, rows, fields){
            sendDbError(res, err, db);
            releaseConnection(db);
            updateHistory(req.body.comment, req.body.env, function(err){
                res.header(json).
                status(err === undefined ? 200 : 500).
                send({
                    success: err === undefined,
                    message: errOutput(err)
                });
            });
        });
    });
}
function readTags(req, res){
    getConnection(function(err, db){
        sendDbError(res, err, db);
        db.query(parmFormat(q.getConfig, {env: req.body.env}),function(err, crows, fields){
            sendDbError(res, err, db);
            db.query(parmFormat(q.getHistoryOverview, {env: req.body.env}),function(err, hrows, fields){
                sendDbError(res, err, db);
                releaseConnection(db);
                res.header(json).
                send({
                    tagErrors: tagErrors,
                    config: crows,
                    history: hrows,
                    environments: config.environments,
                    gitType: config.git.type,
                    versionHash: scriptVersions[req.body.env],
                    controlServers: config.controlServers
                });
            });
        });
    });
}
function readHistory(req, res){
    getConnection(function(err, db){
        sendDbError(res, err, db);
        db.query(parmFormat(q.getHistory, {historyId: req.body.historyId}),function(err, rows, fields){
            releaseConnection(db);
            res.header(json).
            send(rows);
        });
    });
}
function updateHistory(comment, env, callback){
    var hpram = {env: env},
        checkErr = function(err, db){
            if(err){
                if(db){
                    releaseConnection(db);
                }
                callback(err);
            }
        };
    buildMainScript(hpram.env, false, function(buildError, output){
        checkErr(buildError);
        hpram.historyId = createUUID();
        hpram.comment = comment;
        hpram.timestamp = new Date().getTime();
        hpram.version = output.version;
        hpram.buildOutput = output.build;
        getConnection(function(err, db){
            db.query(parmFormat(q.updateHistory1, hpram), function(err){
                checkErr(err, db);
                db.query(parmFormat(q.updateHistory2, hpram), function(err){
                    checkErr(err, db);
                    db.query(parmFormat(q.updateHistory3, hpram), function(err){
                        releaseConnection(db);
                        checkErr(err);
                        updateBuildData(env, output, function(err){
                            checkErr(err);
                            return callback(buildError);
                        });
                    });
                });
            });
        });
    });
}
function updateBuildData(env, output, callback){
    callback = callback || function(){};
    var checkErr = function(err){
        if(err){ callback(err); }
    };
    getConnection(function(err, db){
        checkErr(err);
        db.query(parmFormat(q.updateBuildData1, { env: env, ver: output.version, buildOutput: output.build, builtOn:  (new Date().getTime())}), function(err, rows, fields){
            checkErr(err);
            db.query(parmFormat(q.updateBuildData2, { env: env }), function(err, rows, fields){
                checkErr(err);
                releaseConnection(db);
                if(rows.length>0 && buildCache[env]){
                    buildCache[env].builtOn = new Date(rows[0].timestamp);
                    buildCache[env].builtOnUtc = buildCache[env].builtOn.toUTCString();
                }
                return callback();
            });
        });
    });
}
function revertHistoryState(req, res){
    var p = {
        historyId: req.body.historyId,
        env: req.body.env
    };
    getConnection(function(err, db){
        sendDbError(res, err, db);
        db.query(parmFormat(q.revertState1, p), function(err){
            sendDbError(res, err, db);
            db.query(parmFormat(q.revertState2, p), function(err, rows){
                releaseConnection(db);
                buildMainScript(p.env, false, function(err){
                    res.header(json).
                    send({
                        success: err === undefined,
                        err: errOutput(err)
                    });
                });
            });
        });
    });
}
function parmFormat(query, values) {
    if (!values) return query;
    return query.replace(/\:(\w+)/g, function (txt, key) {
        if (values.hasOwnProperty(key)) {
            if(typeof values[key] === 'string'){
                return values[key].replace(/'/g, "''");
            }else if(typeof values[key] === 'number' || typeof values[key] === 'boolean'){
                return values[key];
            }else{
                return '';
            }
        }
        return txt;
    }.bind(this));
}
function sendDbError(res, err, db){
    if(err){
        log(err);
        releaseConnection(db);
        res.header(json).
        send({
            success: false,
            err: [JSON.stringify(err)]
        });
    }
}
function createUUID() {
    var s = [];
    var hexDigits = '0123456789ABCDEF';
    for (var i = 0; i < 32; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[12] = '4';
    s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);
    var uuid = s.join('');
    return uuid.substring(0, 8) + '-' + uuid.substring(8, 12) + '-' + uuid.substring(12, 16) + '-' + uuid.substring(16, 20) + '-' + uuid.substring(20, 32);
}
function controllerScript(req, res, next) {
    req.params.env = req.params.env === 'www' ? 'prd' : req.params.env;
    if(controllers.buildCache[req.params.env]){
        var d = new Date(),
            c = controllers.buildCache[req.params.env],
            m = new Date(req.headers['if-modified-since']),
            h = {
                'content-type': 'text/javascript',
                'cache-control': 'max-age=' + config.cacheExpiresSeconds,
                'date': d.toUTCString(),
                'expires': new Date(d.setSeconds(config.cacheExpiresSeconds)).toUTCString(),
                'last-modified': (c.builtOnUtc || new Date(0).toUTCString()),
                'etag': config.etag ? '"' + (c.hash || 0) + '"' : undefined,
                'server': host
            };
        if(!isNaN(m.getTime())){
            if(m>=c.builtOn && req.headers['if-none-match'] === c.hash){
                return res.header(h).status(304).send('Not Modified');
            }
        }
        return res.header(h).status(200).send(c.build);
    }else{
        controllers.buildMainScript(req.params.env, true, function(err, content){
            if(err){
                return res.status(404).header(text).send('File Not Found');
            }else{
                return controllerScript(req, res, next);
            }
        });
        
    }
}
function controllerBuild(req, res, next) {
    if(controllers.checkEnv(req.params.env, req, res)){
        controllers.buildMainScript(req.params.env, true, function(err, content){
            if(err){
                res.header(json).
                status(500).
                send({error:1, message:err});
                return;
            }
            buildResponse = {
                env: req.params.env
            };
            if(err){
                buildResponse.err = err;
            }else{
                buildResponse.content = new Buffer(content).toString('base64');
                buildResponse.encoding = 'base64';
                buildResponse.length = content.length;
            }
            res.header(json).
            send(JSON.stringify(buildResponse));
        });
    }
}
function controllerVersion(req, res, next) {
    res.header(json).
    send(controllers.scriptVersions[req.params.env]);
}
function controllerResponder(req, res, next) {
    controllers[req.body.method](req, res, req.body);
}
function controllerHelp(req, res, next) {
    fs.readFile('./README.md', function(err, data){
        res.
        status(200).
        header(html).
        send('<!DOCTYPE html><html><head><link rel="stylesheet" href="/css/markdown.css">' +
            '<title>Vestigium TMS Help</title></head><body>' +
            markdown.toHTML(data.toString()) + '</body></html>');
    });
}
module.exports = function(args){
    config = args.config;
    pool = args.pool;
    log = args.log;
    environments = config.environments;
    controllers = {
        controllerHelp: controllerHelp,
        controllerScript: controllerScript,
        controllerBuild: controllerBuild,
        controllerVersion: controllerVersion,
        controllerResponder: controllerResponder,
        createTag: createTag,
        updateTag: updateTag,
        deleteTag: deleteTag,
        readTags: readTags,
        readHistory: readHistory,
        copyTag: copyTag,
        buildMainScript: buildMainScript,
        buildAll: buildAll,
        checkEnv: checkEnv,
        getGitContents: getGitContents,
        createHash: createHash,
        buildCache: buildCache,
        loaderScripts: loaderScripts,
        scriptVersions: scriptVersions,
        revertHistoryState: revertHistoryState,
        queries: q
    };
    return controllers;
};
