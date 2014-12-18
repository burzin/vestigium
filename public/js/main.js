/*jslint loopfunc: true */
$(function(){
    var content = document.getElementById('content'),
        history = document.getElementById('history'),
        nav = document.getElementById('navtabs'),
        x,
        gitType,
        activeName,
        activeHistoryId,
        envs = ["dev", "int", "stg", "prd"],
        tabs = [],
        headers = ['id', 'env', 'Repository', 'Name', 'Path', 'Ref/Branch/Tag', 'Date',
        'historyId', 'Comment', 'Enabled', 'version', 'buildOutput', 'parentId'],
        configFields = ['id', 'env', 'repoid', 'url', 'path', 'ref', 'timestamp',
        'historyId', 'comment', 'enabled', 'version', 'buildOutput', 'parentId'],
        historyHeaders = ['historyDetailId', 'id', 'env', 'Repository', 'Name', 'Path',
        'Ref/Branch/Tag', 'Date', 'comment', 'historyId', 'historyTimestamp', 'Enabled', 'version', 'buildOutput', 'parentId'],
        topZIndex = 2000;
    for(x = 0; x < envs.length; x++){
        (function(x){
            var button = document.createElement('button');
            tabs.push(button);
            button.navIndex = x;
            if(x === 0){
                button.className = 'btn btn-default active';
            }else{
                button.className = 'btn btn-default';
            }
            button.innerHTML = envs[x];
            button.onclick = function(){
                refreshContent(envs[this.navIndex]);
                activeName = envs[this.navIndex];
                for(x = 0; x < tabs.length; x++){
                    if(this.navIndex === tabs[x].navIndex){
                        tabs[x].className = 'btn btn-default active';
                    }else{
                        tabs[x].className = 'btn btn-default';
                    }
                }
            };
            nav.appendChild(button);
        }(x));
    }
    refreshContent(envs[0]);
    function bindErrorMessage(row, err){
        var m;
        row.onmouseover = function(){
            if(!m){
                m = message({
                    title: '<b>Tag Error</b>',
                    body: formatTagError(err),
                    timeout: 60000,
                    width: '600px',
                    height: '160px',
                    scroll: true,
                    level: 'danger'
                });
            }
        };
        row.onmouseout = function(e){
            if(e.relatedTarget === m){
                return;
            }
            if(m){
                m.close();
                m = undefined;
            }
        };
    }
    function formatTagError(e){
        return e.replace(/PK:([^:]+)/,'').replace(/\n/g,'<br>');
    }
    function buildFailure(e){
        var msgs = JSON.parse(e.responseText).message,
            pkRegCap = /PK:([^:]+)/,
            pk,
            badRow,
            outputMessage = [];
        msgs.forEach(function(msg){
            pk = pkRegCap.exec(msg)[1];
            badRow = document.getElementById(pk);
            if(badRow){
                badRow.style.background = '#d9534f';
                badRow.style.color = 'white';
                bindErrorMessage(badRow, formatTagError(msg));
            }
            outputMessage.push(formatTagError(msg));
        });
        message({
            title: '<b>Build Failed!</b>',
            body: outputMessage.join('<hr>'),
            timeout: 6000,
            width: '600px',
            height: '160px',
            scroll: true,
            level: 'danger'
        });
    }
    function refreshContent(env){
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'readTags',
                env: env
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                history.innerHTML = '';
                content.innerHTML = '';
                gitType = e.gitType;
                e.history = e.history || [];
                e.config = e.config || [];
                if(e.config.length > 0){
                    content.innerHTML += '<h3 class="titleBox">Current Tags in <b>' + env +
                    '</b><br><small>Comment: ' + e.config[0].comment +
                    '<br>Version: ' + e.config[0].version +
                    (e.config[0].builtOn ? '<br>Built On: ' + (new Date(e.config[0].builtOn).toISOString()) : '') + '</small></h3>';
                }else{
                    content.innerHTML += '<h3 class="titleBox">No tags in <b>' + env + '</b><br><small>Add some tags</small></h3>';
                }
                var rebuild = document.createElement('button'),
                    showbuild = document.createElement('button'),
                    x,
                    f,
                    addButton = document.createElement('button'),
                    t;
                rebuild.onclick = function(){
                    var butt = this;
                    butt.disabled = true;
                    $('.hoverrow').each(function(){
                        this.style.background = '';
                    });
                    // n+1 mega hack:
                    // TODO: someday replace with this a proper n+1 implementation
                    // whatever that might look like 
                    var work = e.controlServers.map(doRebuild);
                    function doRebuild(baseURL){
                        return function(done){
                            $.ajax({
                                url: baseURL + '/build/' + env,
                                method: 'get',
                                success: function(){ done(); },
                                error: done
                            });
                        };
                    }
                    async.parallel(work, function(err){
                        if(err){
                            return buildFailure();
                        }
                        message({
                            title: 'Published successfully',
                            body: 'Build successfully completed',
                            timeout: 3000,
                            level: 'good'
                        });
                        refreshContent(env);
                        butt.disabled = false;
                    });
                };
                showbuild.onclick = function(){
                    window.open('/tagjs/' + env + '/main.js');
                };
                showbuild.className = 'btn btn-primary';
                showbuild.style.display = 'inline-block';
                showbuild.innerHTML = 'Show Published Script';
                rebuild.className = 'btn btn-primary';
                rebuild.style.display = 'inline-block';
                rebuild.innerHTML = 'Publish All Tags';
                rebuild.style.margin = '0 10px 0 10px';
                content.appendChild(rebuild);
                content.appendChild(showbuild);
                content.appendChild(addButton);
                var clickToEdit = document.createElement('div');
                clickToEdit.innerHTML = '<i style="margin-left:10px;">Click row to edit</i>';
                clickToEdit.style.marginLeft = '10px';
                content.appendChild(clickToEdit);
                t = createTable(e.config, headers, function(x, y, data, datas){
                    if([0, 1, 7, 8, 10, 11, 12, 13, 14].indexOf(y) !== -1){
                        if(y === 0){
                            this.parentNode.id = data;
                            if(e.tagErrors[data] !== undefined){
                                this.parentNode.style.background = '#d9534f';
                                this.parentNode.style.color = 'white';
                                e.tagErrors[data].toString = function(){
                                    var t = e.tagErrors[data];
                                    if(t.annotated){
                                        return t.annotated + ':' + t.line + ':' + t.column + '\n' + t.message;
                                    }else{
                                        return t.syscall + ':' + t.errno + '(' + t.code + ')';
                                    }
                                };
                                bindErrorMessage(this.parentNode, e.tagErrors[data].toString());
                            }
                        }
                        this.style.display = 'none';
                        this.style.visibility = 'hidden';
                    }else if(y === 9 && x !== -1){
                        this.innerHTML = '';
                        if(data === 1){
                            this.className = 'glyphicon glyphicon-ok';
                            this.style.color = 'green';
                        }
                    }else if(y === 6 && typeof data === 'number'){
                        this.innerHTML = new Date(data).toISOString();
                    }else if(x === -1 && y === 2){
                        this.innerHTML = (gitType === 'gitlabs' ? 'GitLabs' : 'GitHub') + ' Repository';
                    }
                });
                select = document.createElement('select');
                select.style.marginLeft = '10px';
                t.className = 'hovert table';
                for(x = 0; x < e.history.length; x++){
                    if(x === 0){
                        fillHistory(e.history[x].historyId, env);
                    }
                    var o = document.createElement('option');
                    o.value = e.history[x].historyId;
                    o.text = new Date(e.history[x].timestamp).toISOString() + ' ' + e.history[x].comment;
                    select.appendChild(o);
                }
                select.onchange = function(){
                    fillHistory(this.value, env);
                };
                if(e.config.length > 0){
                    content.appendChild(t);
                }
                
                addButton.innerHTML = 'Add Tag';
                addButton.className = 'btn btn-primary';
                addButton.style.margin = '20px 60px 20px 10px';
                addButton.onclick = function(){
                    var control = {},
                    x,
                    data = {};
                    for(x = 0; x < configFields.length; x++){
                        if(configFields[x] === 'id'){
                            data[configFields[x]] = createUUID();
                        }else if(configFields[x] === 'env'){
                            data[configFields[x]] = env;
                        }else{
                            data[configFields[x]] = '';
                        }
                    }
                    data.comment = '';
                    var d = dialog('Add a new tag'),
                    f = createForm({
                        headers: headers,
                        disabled: ['id'],
                        checkboxes: ['enabled'],
                        obj: data,
                        dontSubmit: ['timestamp', 'historyId', 'version', 'buildOutput', 'buildTime', 'builtOn'],
                        hidden: ['env', 'parentId'],
                        submit: function submit(obj, inputs){
                            control.obj = obj;
                            control.inputs = inputs;
                            return function(){
                                control.inputs.get('enabled').value = control.inputs.get('enabled').checked ? 1 : 0;
                                if(control.inputs.get('comment').value.length === 0){
                                    message({
                                        title: 'Validation Failure',
                                        body: 'A comment describing what you have done is required to add a tag.',
                                        timeout: 3000,
                                        level: 'danger'
                                    });
                                    control.inputs.get('comment').focus();
                                    return;
                                }
                                this.disabled = true;
                                addTag(control.inputs, function(){
                                    d.close();
                                    refreshContent(env);
                                });
                            };
                        },
                        cancel: function(obj, inputs){
                            control.obj = obj;
                            control.inputs = inputs;
                            return function(){
                                d.close();
                            };
                        },
                        submitText: 'Add Tag',
                        cancelText: 'Cancel'
                    });
                    f.style.marginTop = '10px';
                    f.inputs.forEach(function(input){
                        input.addEventListener('keydown', function(e){
                            if(e.keyCode === 13){
                                submit();
                            }else if(e.keyCode === 27){
                                d.close();
                            }
                        });
                    });
                    d.content([f.submitButton, f.cancelButton, f]);
                };
                var historyTitle = document.createElement('h4');
                var revert = document.createElement('button');
                revert.className = 'btn btn-primary';
                revert.style.display = 'block';
                revert.innerHTML = 'Revert To This State';
                revert.style.margin = '10px';
                revert.onclick = function(){
                    revertHistoryState(activeHistoryId, env, function(){
                        refreshContent(env);
                    });
                };
                historyTitle.innerHTML = '<h3 class="titleBox">Change History for ' + env + '</h3>';
                historyTitle.id = 'changeHistory';
                if(e.history.length > 0){
                    content.appendChild(historyTitle);
                    content.appendChild(select);
                    content.appendChild(revert);
                }
                for(x = 0; x < t.data.length; x++){
                    (function(x){
                        t.data[x][0].parentNode.addEventListener('click', function(){
                            var data = this.rowData,
                                d = dialog(env + ' - Editing ' + data.url),
                                control = {};
                            data.comment = '';
                            f = createForm({
                                headers: headers,
                                disabled: ['id'],
                                dontSubmit: ['timestamp', 'historyId', 'version', 'buildOutput', 'buildTime', 'builtOn'],
                                hidden: ['env', 'parentId'],
                                checkboxes: ['enabled'],
                                obj: data,
                                submit: function(obj, inputs){
                                    control.obj = obj;
                                    control.inputs = inputs;
                                    return function(){
                                        control.inputs.get('enabled').value = control.inputs.get('enabled').checked ? 1 : 0;
                                        if(control.inputs.get('comment').value.length === 0){
                                            message({
                                                title: 'Validation Failure',
                                                body: 'A comment describing what you have done is required to update a tag.',
                                                timeout: 3000,
                                                level: 'danger'
                                            });
                                            return;
                                        }
                                        this.disabled = true;
                                        saveData({
                                            original: control.obj,
                                            submitted: control.inputs,
                                            callback: function(e){
                                                d.close();
                                                refreshContent(env);
                                            }
                                        });
                                    };
                                },
                                cancel: function(obj, inputs){
                                    control.obj = obj;
                                    control.inputs = inputs;
                                    return function(){
                                        this.disabled = true;
                                        d.close();
                                    };
                                },
                                move: function(obj, inputs){
                                    control.obj = obj;
                                    control.inputs = inputs;
                                    return function(){
                                        var mvd = dialog('Please select an environment to copy to.',
                                            {height: '160px'}),
                                            selectMessage = document.createElement('p'),
                                            ok = document.createElement('button'),
                                            cancel = document.createElement('button'),
                                            selectedEnv,
                                            btnGroup = document.createElement('div'),
                                            fromButtonGroup = document.createElement('div'),
                                            fromButton = document.createElement('div'),
                                            x = 0,
                                            envButtons = [],
                                            arrowGlyph = document.createElement('div');
                                        arrowGlyph.className = 'glyphicon glyphicon-arrow-right';
                                        arrowGlyph.style.color = '#5bc0de';
                                        arrowGlyph.style.height = '50px';
                                        arrowGlyph.style.width = '50px';
                                        arrowGlyph.style.fontSize = '40px';
                                        arrowGlyph.style.margin = '-20px 0 15px 0';
                                        arrowGlyph.style.verticalAlign = 'text-top';
                                        ok.className = 'btn btn-primary';
                                        cancel.className = 'btn btn-primary';
                                        fromButton.className = 'btn btn-info';
                                        btnGroup.className = 'btn-group';
                                        fromButtonGroup.className = 'btn-group';
                                        btnGroup.style.margin = '10px 10px 15px -8px';
                                        ok.innerHTML = 'Copy';
                                        ok.style.margin = '0 10px 0 200px';
                                        cancel.style.margin = '0 10px 0 10px';
                                        cancel.innerHTML = 'Cancel';
                                        fromButton.innerHTML = env;
                                        fromButtonGroup.style.margin = '10px 0 15px 73px';
                                        fromButtonGroup.appendChild(fromButton);
                                        envs.forEach(function(v){
                                            if(env === v){ return; }
                                            if(x === 0){
                                                selectedEnv = v;
                                            }
                                            var b = document.createElement('button');
                                            b.innerHTML = v;
                                            b.env = v;
                                            b.className = 'btn btn-default' + (x++ === 0 ? ' active' : '');
                                            b.onclick = function(){
                                                selectedEnv = v;
                                                envButtons.forEach(function(n){
                                                    n.className = 'btn btn-default' + (n.env === v ? ' active' : '');
                                                });
                                            };
                                            envButtons.push(b);
                                            btnGroup.appendChild(b);
                                        });
                                        cancel.onclick = function(){
                                            mvd.close();
                                        };
                                        ok.onclick = function(){
                                            this.disabled = true;
                                            copyTag(control.inputs.get('parentId').value, env, selectedEnv, function(e){
                                                mvd.close();
                                            });
                                        };
                                        mvd.content([fromButtonGroup, arrowGlyph, btnGroup, ok, cancel]);
                                        btnGroup.style.display = 'inline-block';
                                    };
                                },
                                delete: function(){
                                    return function(){
                                        var deld = dialog('Are you sure you want to delete this tag?',
                                            {height: '185px'}),
                                            ok = document.createElement('button'),
                                            cancel = document.createElement('button'),
                                            confirmMessage = document.createElement('p'),
                                            comment = document.createElement('input');
                                        ok.className = 'btn btn-primary';
                                        cancel.className = 'btn btn-primary';
                                        cancel.onclick = function(){
                                            deld.close();
                                        };
                                        ok.onclick = function submit(){
                                            if(comment.value.length === 0){
                                                message({
                                                    title:'Validation Failure', 
                                                    body:'A comment describing what you have done is required to update a tag.',
                                                    timeout: 3000,
                                                    level: 'danger'
                                                });
                                                comment.focus();
                                                return;
                                            }
                                            this.disabled = true;
                                            deleteTag(data.id, comment.value, env, function(){
                                                deld.close();
                                                d.close();
                                                refreshContent(env);
                                            });
                                        };
                                        comment.onkeydown = function(e){
                                            if(e.keyCode === 13){
                                                ok.onclick();
                                            }else if(e.keyCode === 27){
                                                deld.close();
                                            }
                                        };
                                        comment.style.marginBottom = '10px';
                                        comment.style.width = '80%';
                                        ok.style.marginRight = '10px';
                                        ok.innerHTML = 'OK';
                                        cancel.innerHTML = 'Cancel';
                                        confirmMessage.innerHTML = 'You can\'t undo this operation!<br>Comment:';
                                        deld.content([confirmMessage, comment, document.createElement('br'), ok, cancel]);
                                        comment.focus();
                                    };
                                },
                                submitText: 'Save',
                                deleteText: 'Delete Tag',
                                cancelText: 'Cancel'
                            });
                            f.style.marginTop = '10px';
                            d.content([f.submitButton, f.cancelButton, f.deleteButton, f.moveButton, f]);
                            f.inputs.forEach(function(input){
                                input.addEventListener('keydown', function(e){
                                    if(e.keyCode === 13){
                                        submit();
                                    }else if(e.keyCode === 27){
                                        d.close();
                                    }
                                });
                            });
                        });
                    }(x));
                }
            }
        });
    }
    function addTag(inputs, callback){
        var data = {};
        for(var x = 0; x < inputs.length; x++){
            data[inputs[x].name] = inputs[x].value;
        }
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'createTag',
                inputs: data
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                if(callback){
                    callback(e);
                }
            },
            error: function(e){
                buildFailure(e);
                if(callback){
                    callback(e);
                }
            }
        });
    }
    function copyTag(tagId, srcEnv, targetEnv, callback){
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'copyTag',
                id: tagId,
                comment: 'Copied ' + tagId + ' from ' + srcEnv + ' to ' + targetEnv,
                targetEnv: targetEnv,
                srcEnv: srcEnv
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                if(callback){
                    callback();
                }
            },
            error: function(e){
                if(callback){
                    callback(e);
                }
            }
        });
    }
    function deleteTag(id, comment, env, callback){
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'deleteTag',
                id: id,
                comment: comment,
                env: env
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                if(callback){
                    callback(e);
                }
            },
            error: buildFailure
        });
    }
    function revertHistoryState(historyId, env, callback){
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'revertHistoryState',
                historyId: historyId,
                env: env
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                message({
                    title: 'State reverted',
                    body: 'History state reverted successfully.',
                    timeout: 3000,
                    level: 'info'
                });
                callback(e);
            },
            error: function(e){
                buildFailure(e);
                callback(e);
            }
        });
    }
    function fillHistory(historyId, env){
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'readHistory',
                historyId: historyId
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                activeHistoryId = historyId;
                var t = createTable(e, historyHeaders, function(x, y, data, datas){
                    if([0, 1, 2, 8, 9, 10, 12, 13, 14, 15].indexOf(y) !== -1){
                        this.style.display = 'none';
                        this.style.visibility = 'hidden';
                    }else if(y === 11 && x !== -1){
                        this.innerHTML = '';
                        if(data === 1){
                            this.className = 'glyphicon glyphicon-ok';
                            this.style.color = 'green';
                        }
                    }else if(y === 7 && typeof data === 'number'){
                        this.innerHTML = new Date(data).toISOString();
                    }
                });
                t.className = 'table';
                history.innerHTML = '';
                if(e.length > 0){
                    var date = new Date(e[0].snapdate).toISOString(),
                        historyTitle = document.getElementById('changeHistory');
                        historyTitle.innerHTML = '<h3 class="titleBox" id="changeHistory">Change History for ' +
                        env + '<br><small>Comment: ' + e[0].comment + '<br>Version: ' + e[0].version + 
                        '<br>Changed On: ' + date + '</small></h3>';
                    history.appendChild(t);
                }
            }
        });
    }
    function dialog(title, rect){
        rect = rect || {};
        rect.width = rect.width || '400px';
        rect.height = rect.height || '535px';
        var d = document.createElement('div');
        var b = document.createElement('div');
        b.style.zIndex = ++topZIndex;
        b.style.position = 'fixed';
        b.style.top = 0;
        b.style.left = 0;
        b.style.height = '100%';
        b.style.width = '100%';
        // 50% transparent px
        b.style.background = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAA9JREFUeNpiYGBgaAAIMAAAhQCB69VMmQAAAABJRU5ErkJggg==)';
        d.style.position = 'fixed';
        d.style.width = rect.width;
        d.style.zIndex = ++topZIndex;
        d.style.top = '60px';
        d.style.left = '25%';
        d.style.height = rect.height;
        d.style.overflow = 'auto';
        d.content = function(eles){
            for(var x = 0; x < eles.length; x++){
                d.appendChild(eles[x]);
            }
            return d;
        };
        d.close = function(){
            d.parentNode.removeChild(d);
            b.parentNode.removeChild(b);
            window.removeEventListener('resize', resize);
        };
        var t = document.createElement('h3');
        t.innerHTML = title;
        t.className = 'titleBox';
        t.style.margin = '-10px -10px 10px -10px';
        t.style.fontSize = '16px';
        t.style.padding = '10px';
        d.appendChild(t);
        d.style.background = 'white';
        d.style.border = 'solid 1px #000';
        d.style.padding = '10px';
        document.body.appendChild(b);
        document.body.appendChild(d);
        function resize(){
            var w = document.documentElement.clientWidth;
            d.style.left = (w * 0.5) - (d.offsetWidth * 0.5) + 'px';
        }
        resize();
        window.addEventListener('resize', resize);
        return d;
    }
    function createForm(args){
        args.submit = args.submit || function(){};
        args.delete = args.delete || function(){};
        args.cancel = args.cancel || function(){};
        args.move = args.move || function(){};
        args.disabled = args.disabled || [];
        args.hidden = args.hidden || [];
        var keys = Object.keys(args.obj),
            d = document.createElement('div'),
            fg,
            label,
            x,
            input,
            inputs = [],
            submitButton,
            cancelButton,
            moveButton;
        for(x = 0; x < keys.length; x++){
            if(args.dontSubmit.indexOf(keys[x]) !== -1){ continue; }
            input = document.createElement('input');
            if(args.checkboxes.indexOf(keys[x]) !== -1){
                input.type = 'checkbox';
                input.checked = args.obj[keys[x]] === 1;
            }else{
                input.value = args.obj[keys[x]];
            }
            input.name = keys[x];
            inputs.push(input);
            if(args.hidden.indexOf(keys[x]) !== -1){ continue; }
            fg = document.createElement('tr');
            fg.className = 'form-group';
            label = document.createElement('label');
            label.setAttribute('for', keys[x]);
            input.className = 'form-control';
            input.style.width = '350px';
            input.disabled = args.disabled.indexOf(keys[x]) !== -1;
            fg.appendChild(label);
            fg.appendChild(input);
            if(args.headers){
                label.innerHTML = args.headers ? args.headers[x] : keys[x];
            }else{
                label.innerHTML = args.headers[x] ? args.headers[x] : keys[x];
            }
            d.appendChild(fg);
        }
        inputs.get = function(name){
            for(var x = 0; x < inputs.length; x++){
                if(inputs[x].name === name){
                    return inputs[x];
                }
            }
        };
        submitButton = document.createElement('button');
        submitButton.className = 'btn btn-primary';
        cancelButton = document.createElement('button');
        cancelButton.className = 'btn btn-primary';
        deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-primary';
        moveButton = document.createElement('button');
        moveButton.className = 'btn btn-primary';
        cancelButton.innerHTML = args.cancelText || 'Cancel';
        submitButton.innerHTML = args.submitText || 'Submit';
        deleteButton.innerHTML = args.deleteText || 'Delete';
        moveButton.innerHTML = args.moveText || 'Copy';
        submitButton.onclick = args.submit(args.obj, inputs);
        submitButton.style.margin = '5px 10px 0 10px';
        cancelButton.onclick = args.cancel(args.obj, inputs);
        cancelButton.style.margin = '5px 10px 0 10px';
        deleteButton.onclick = args.delete(args.obj, inputs);
        deleteButton.style.margin = '5px 10px 0 10px';
        moveButton.onclick = args.move(args.obj, inputs);
        moveButton.style.margin = '5px 10px 0 10px';
        d.submitButton = submitButton;
        d.cancelButton = cancelButton;
        d.deleteButton = deleteButton;
        d.moveButton = moveButton;
        d.inputs = inputs;
        return d;
    }
    function createTable(data, headers, oninsert){
        oninsert = oninsert || function(){};
        var t = document.createElement('table'),
            x,
            r,
            f,
            y,
            c,
            row,
            rows = [];
        if(headers){
            r = document.createElement('tr');
            row = [];
            t.appendChild(r);
            for(x = 0; x < headers.length; x++){
                c = document.createElement('th');
                c.innerHTML = headers[x];
                r.appendChild(c);
                oninsert.apply(c, [-1, x, headers[x], headers]);
                row.push(c);
            }
            rows.push(row);
        }
        for(x = 0; x < data.length; x++){
            (function(x){
                row = [];
                r = document.createElement('tr');
                r.className = 'hoverrow';
                r.rowData = data[x];
                t.appendChild(r);
                f = Object.keys(data[x]);
                for(y = 0; y < f.length; y++){
                    c = document.createElement('td');
                    r.appendChild(c);
                    if(data[x][f[y]].tagName !== undefined){
                        c.appendChild(data[x][f[y]]);
                    }else{
                        c.innerHTML = data[x][f[y]];
                    }
                    oninsert.apply(c, [x, y, data[x][f[y]], data]);
                    row.push(c);
                }
                rows.push(row);
            }(x));
        }
        t.data = rows;
        return t;
    }
    function saveData(args){
        var o = args.original,
            n = args.submitted,
            data = {};
        for(var x = 0; x < n.length; x++){
            data[n[x].name] = n[x].value;
        }
        $.ajax({
            url: 'responder',
            data: JSON.stringify({
                method: 'updateTag',
                inputs: data
            }),
            method: 'post',
            contentType: 'application/json',
            success: function(e){
                message({
                    title: 'Tag Saved',
                    body: 'Tag saved successfully',
                    timeout: 3000,
                    level: 'info'
                });
                if(args.callback){
                    args.callback(e);
                }
            },
            error: function(e){
                buildFailure(e);
                if(args.callback){
                    args.callback(e);
                }
            }
        });
    }
    function message(args){
        var d = document.createElement('div'),
            h = document.createElement('span'),
            s = document.createElement('p'),
            c = document.createElement('button');
        c.className = 'glyphicon glyphicon-remove btn btn-default';
        c.style.cssFloat = 'right';
        s.innerHTML = args.body;
        h.innerHTML = args.title;
        d.appendChild(c);
        d.appendChild(h);
        d.appendChild(s);
        d.style.position = 'fixed';
        d.style.boxShadow = '1px 1px 1px 1px #8F6060';
        d.style.zIndex = ++topZIndex;
        if(args.level === 'danger'){
            d.style.background = '#d9534f';
            d.style.border = 'solid 1px #d43f3a';
        }else if(args.level === 'good'){
            d.style.background = '#5cb85c';
            d.style.border = 'solid 1px #4cae4c';
        }else{
            d.style.background = '#5bc0de';
            d.style.border = 'solid 1px #46b8da';
        }
        d.style.color = 'white';
        d.style.borderRadius = '3px';
        d.style.top = '60px';
        d.style.left = '20px';
        d.style.height = args.height || '100px';
        d.style.width = args.width || '300px';
        d.style.padding = '10px';
        c.onclick = function(){
            d.close();
        };
        d.close = function(){
            if(d.parentNode){
                d.parentNode.removeChild(d);
            }
        };
        setTimeout(d.close, args.timeout);
        document.body.appendChild(d);
        return d;
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
});