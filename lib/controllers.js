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
    log,
    tagErrors = {},
    pool,
    q = {
        revertState1: "delete from configuration where (select count(0) from configurationHistoryDetail " + 
        " where historyId = ':historyId' and env = ':env') > 0 and env = ':env';",
        revertState2: "insert into configuration select id, d.env, repoid, url, path, ref, d.timestamp, h.historyId, h.comment, d.enabled, version, buildOutput " +
        " from configurationHistory h inner join configurationHistoryDetail d on d.historyId = h.historyId where h.historyId = ':historyId' and h.env = ':env';",
        deleteConfig: "delete from configuration where id = ':id';",
        getConfig: "select id, env, repoid, url, path, ref, timestamp, historyId, comment, enabled, " + 
        " version, buildOutput from configuration where env = ':env' order by repoid, ref, path;",
        updateHistory1: "insert into configurationHistory (historyId, timestamp, comment, env) " +
        " values (':historyId', :timestamp, ':comment', ':env');",
        updateHistory2: "insert into configurationHistoryDetail " +
        " select UUID() as historyDetailId, env, repoid, url, path, ref, timestamp, ':historyId' as historyId, id, enabled, ':version', ':buildOutput' " + 
        " from configuration where env = ':env';",
        updateHistory3: "update configuration set historyId = ':historyId', comment = ':comment', " + 
        "version = ':version', buildOutput = ':buildOutput' where env = ':env';",
        updateConfig: "update configuration set env = ':env', repoid = ':repoid', " + 
        " url = ':url', path = ':path', ref = ':ref', timestamp = :timestamp, " + 
        " enabled = :enabled, version = '-1', buildOutput = '' where id = ':id';",
        insertConfig: "insert into configuration (id, env, repoid, url, path, ref, timestamp, historyId, comment, enabled, version, buildOutput) values " +
        " (':id', ':env', ':repoid', ':url', ':path', ':ref', :timestamp, '', '', :enabled, ':version', ':buildOutput');",
        getHistoryOverview: "select historyId, timestamp, comment, env " + 
        " from configurationHistory where env = ':env' order by timestamp desc;",
        getHistory: "select historyDetailId, id, h.env, repoid, url, path, ref, d.timestamp, comment, h.historyId, h.timestamp as snapdate, d.enabled, version, buildOutput " +
        " from configurationHistory h inner join configurationHistoryDetail d on d.historyId = h.historyId " +
        " where d.historyId = ':historyId';",
        getBuild: "select buildOutput from configurationHistoryDetail where version = ':version' and env = ':env' limit 1;"
    },
    buildCache = {},
    loaderScripts = {},
    scriptVersions = {};
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
function getGitContents(id, path, ref, callback){
    ref = ref ? '&ref=' + ref : '';
    var options = {
        hostname: config.git.host,
        port: config.git.port,
        path: config.git.path.
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
function buildMainScript(env, callback){
    var content = [],
        procs = [],
        errors = [],
        ver = '0';
        scriptVersions[env] = scriptVersions[env] || { version: '0' };
    pool.getConnection(function(err, db){
        if(err){
            return callback(err);
        }
        db.query(parmFormat(q.getConfig, {env: env}), function(err, rows, fields){
            // id, env, repoid, url, path, ref, timestamp
            if(err){
                return callback(err);
            }
            db.release();
            rows.forEach(function(item){
                procs.push(function(done){
                    getGitContents(item.repoid, item.path, item.ref, function(err, res){
                        var sErr,
                            src,
                            ref = item.ref.replace('&ref=',''),
                            srcRef = item.url + '/' + res.path + '#' + ref + ' PK:' + item.id;
                        if(res.message){
                            err = new Error(res.message + ' ' + srcRef);
                        }
                        if(err){
                            tagErrors[item.id] = err;
                            errors.push(err.toString());
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
                buildId = env + '_' + hash,
                build = '// hash: ' + hash + ' environment: ' + env + ' built on: ' + (new Date().toISOString()) + '\n' +
                    data.toString().replace(boundary, content.join('\n'));
            minify.optimizeData({
                ext: '.js',
                data: build
            }, function(error, data) {
                if(config.minify.indexOf(env) !== -1){
                    build = data;
                }
                fs.writeFile('./build/' + buildId + '.js', build, function(err){
                    if(err){
                        callback(err);
                    }
                    buildCache[buildId] = build;
                    scriptVersions[env].version = ver;
                    callback(errors.length > 0 ? errors : undefined, buildCache[buildId]);
                });
            });
        });
    }
}
function buildAll(callback){
    var procs = [];
    environments.forEach(function(item){
        procs.push(function(done){
            buildMainScript(item, function(err){
                if(err){
                    log('An error occurred while building', item, err);
                }
                done();
            });
        });
    });
    async.parallel(procs, callback);
}
function buildLoader(env){
    fs.readFile('./lib/loader.js', function(err, data){
        var loader = data.toString();
        environments.forEach(function(item){
            if(env === undefined || env === item){
                loaderScripts[item] = loader.replace(/{{{env}}}/g, item);
            }
        });
    });
}
function createTag(req, res){
    pool.getConnection(function(err, db){
        req.body.inputs.timestamp = new Date().getTime();
        db.query(parmFormat(q.insertConfig, req.body.inputs), function(err, rows, fields){
            if(err){
                return sendDbError(res, err, db);
            }
            db.release();
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
    pool.getConnection(function(err, db){
        if(err){
            return sendDbError(res, err, db);
        }
        req.body.inputs.timestamp = new Date().getTime();
        db.query(parmFormat(q.updateConfig, req.body.inputs), function(err, rows, fields){
            if(err){
                return sendDbError(res, err, db);
            }
            db.release();
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
    pool.getConnection(function(err, db){
        db.query(parmFormat(q.deleteConfig, {id: req.body.id}), function(err, rows, fields){
            if(err){
                return sendDbError(res, err, db);
            }
            db.release();
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
    pool.getConnection(function(err, db){
        if(err){
            return sendDbError(res, err, db);
        }
        db.query(parmFormat(q.getConfig, {env: req.body.env}),function(err, crows, fields){
            if(err){
                return sendDbError(res, err, db);
            }
            db.query(parmFormat(q.getHistoryOverview, {env: req.body.env}),function(err, hrows, fields){
                if(err){
                    return sendDbError(res, err, db);
                }
                res.header(json).
                send({
                    tagErrors: tagErrors,
                    config: crows,
                    history: hrows,
                    versionHash: scriptVersions[req.body.env]
                });
                db.release();
            });
        });
    });
}
function readHistory(req, res){
    pool.getConnection(function(err, db){
        if(err){
            return sendDbError(res, err, db);
        }
        db.query(parmFormat(q.getHistory, {historyId: req.body.historyId}),function(err, rows, fields){
            res.header(json).
            send(rows);
            db.release();
        });
    });
}
function updateHistory(comment, env, callback){
    var hpram = {env: env};
    buildMainScript(hpram.env, function(buildError){
        hpram.historyId = createUUID();
        hpram.comment = comment;
        hpram.timestamp = new Date().getTime();
        hpram.version = scriptVersions[env].version;
        hpram.buildOutput = buildCache[env + '_' + scriptVersions[env].version];
        pool.getConnection(function(err, db){
            db.query(parmFormat(q.updateHistory1, hpram), function(err){
                if(err){
                    db.release();
                    return callback(err);
                }
                db.query(parmFormat(q.updateHistory2, hpram), function(err){
                    if(err){
                        db.release();
                        return callback(err);
                    }
                    db.query(parmFormat(q.updateHistory3, hpram), function(err){
                        db.release();
                        if(err){
                            return callback(err);
                        }
                        return callback(buildError);
                    });
                });
            });
        });
    });
}
function revertHistoryState(req, res){
    var p = {
        historyId: req.body.historyId,
        env: req.body.env
    };
    pool.getConnection(function(err, db){
        if(err){
            return sendDbError(res, err, db);
        }
        db.query(parmFormat(q.revertState1, p), function(err){
            if(err){
                return sendDbError(res, err, db);
            }
            db.query(parmFormat(q.revertState2, p), function(err, rows){
                db.release();
                buildMainScript(p.env, function(err){
                    res.header(json).
                    send({
                        success: err === undefined,
                        err: errOutput(err.toString())
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
    res.header(json).
    send({
        success: false,
        err: [JSON.stringify(err)]
    });
    log(err);
    db.release();
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
function controllerLoader(req, res, next) {
    res.header(js).send(controllers.loaderScripts[req.params.env]);
}
function controllerScript(req, res, next) {
    var buildId = req.params.env + '_' + req.params.build,
        buildFile = './build/' + buildId + '.js';
    // check the cache
    if(controllers.buildCache[buildId]){
        res.header(js).
        send(controllers.buildCache[buildId]);
    }else{
        // check the file system
        fs.exists(buildFile, function(exists){
            if(exists){
                fs.readFile(buildFile, function(err, data){
                    controllers.buildCache[buildId] = data;
                    res.header(js).
                    send(data);
                });
            }else{
                // check the database
                pool.getConnection(function(err, db){
                    // pre sanitize input TRUST NO ONE, TRUST NOTHING
                    if(req.params.env.length > 3){
                        req.params.env = 'prd';
                    }
                    if(req.params.build && isNaN(parseInt(req.params.build, 10))){
                        req.params.build = "0";
                    }
                    db.query(parmFormat(q.getBuild, {env: req.params.env, version: req.params.build}), function(err, rows){
                        if(err || !rows || rows.length === 0){
                            return res.header(text).
                            status(404).
                            send('File not found');
                        }
                        controllers.buildCache[buildId] = rows[0].buildOutput;
                        return res.header(js).
                        status(200).
                        send(controllers.buildCache[buildId]);
                    });
                });
            }
        });
    }
}
function controllerBuild(req, res, next) {
    if(controllers.checkEnv(req.params.env, req, res)){
        controllers.buildMainScript(req.params.env, function(err, content){
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
        controllerLoader: controllerLoader,
        controllerScript: controllerScript,
        controllerBuild: controllerBuild,
        controllerVersion: controllerVersion,
        controllerResponder: controllerResponder,
        createTag: createTag,
        updateTag: updateTag,
        deleteTag: deleteTag,
        readTags: readTags,
        readHistory: readHistory,
        buildMainScript: buildMainScript,
        buildLoader: buildLoader,
        buildAll: buildAll,
        checkEnv: checkEnv,
        getGitContents: getGitContents,
        createHash: createHash,
        buildCache: buildCache,
        loaderScripts: loaderScripts,
        scriptVersions: scriptVersions,
        revertHistoryState: revertHistoryState
    };
    return controllers;
};
