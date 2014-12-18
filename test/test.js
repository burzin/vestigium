var proxyquire = require('proxyquire'),
    config = require('../config/default.json'),
    restify = require('restify'),
    should = require('should'),
    resultSet = [{ref:'master', path:'tsa.js', repoid: 'bi/marketing-tags', version:'1'}],
    fsStub = {
        '@noCallThru': true,
        existsSync: function(){ return false; },
        mkdirSync: function(){ return false; }
    },
    createPool = function(config){
        return {
            getConnection: getConnection,
            mkdirSync: function(){}
        };
    },
    getConnection = function(callback){
        callback(undefined, {
            query: query,
            release: function(){}
        });
    },
    query = function(q, callback){
        return callback(undefined, resultSet);
    },
    _query = query,
    _getConnection = getConnection,
    _createPool = createPool,
    mysqlStub = {
        '@noCallThru': true,
        createPool: createPool
    },
    app = proxyquire(__dirname + '/../tms-app.js', {
        'mysql': mysqlStub,
        'fs': fsStub
    });
fsStub.existsSync = function(){ return true; };
var client = restify.createJsonClient({ //err, req, res, obj
        url: 'http://127.0.0.1:' + config.appPort
    }),
    sclient = restify.createStringClient({ //err, req, res, data
        url: 'http://127.0.0.1:' + config.appPort
    });
function rest(method, callback){
    client.post('/responder', {
        method: method,
        env: 'prd',
        inputs: {}
    }, callback);
}
// TODO: These test should actually be tests.
describe('Rest API Checks', function(){
    it('should build all', function(done){
        app.controllers.buildAll(done);
    });
    it('Should show tags', function(done){
        rest('readTags', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should read tag history', function(done){
        rest('readHistory', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should update tags', function(done){
        rest('updateTag', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should delete a tag', function(done){
        rest('deleteTag', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should create a tag', function(done){
        rest('createTag', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should copy a tag', function(done){
        rest('copyTag', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should revert history state', function(done){
        rest('revertHistoryState', function(err, req, res, obj){
            (typeof obj === 'object').should.equal(true);
            done();
        });
    });
    it('Should invoke a build', function(done){
        sclient.get('/build/prd', function(err, req, res, data){
            if(!data){ throw 'No data found!';}
            done();
        });
    });
    it('Should provide some help', function(done){
        sclient.get('/private_tagjs/help', function(err, req, res, data){
            if(!data){ throw 'No data found!';}
            done();
        });
    });
    it('should show a version number', function(done){
        sclient.get('/private_tagjs/prd/ver', function(err, req, res, data){
            if(!data){ throw 'No data found!';}
            done();
        });
    });
    it('should show main script', function(done){
        sclient.get('/tagjs/prd/main.js', function(err, req, res, data){
            if(!data){ throw 'No data found!';}
            done();
        });
    });
    
    it('Should cause a series of rest connection/query errors', function(done){
        //getConnection = function(callback){ callback(1); };
        rest('readTags',done);
    });

});