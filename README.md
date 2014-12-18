Vestigium Tag Management System
==========================

An open source enterprise tag management system. It is meant to be a replacement for Tealium, TMS etc.

What is a tag management system?

A tag management system is a like a content management system (CMS) for Javascript. 
It enables digital marketers to easily deploy and manage all third-party tags from a single web interface, 
while accelerating page load performance and reducing reliance on IT.
Tag management systems allow marketers to be more agile and positively impact the bottom line.

Features
========

* Builds per environment JS files wrapped in a event emitter framework.
* Each tag can reference separate git repositories, commits, files, etc..
* Currently only works with gitlabs API, github support coming soon.

Installing
==========

To install the built script on your web site use the following link:

    <script src="/tms/prd/main.js"></script>

`prd` can be replaced by the environment you want to use on your site.

Config
======

Below is an example of a config file.  Config file must be ./config/default.json


{
    "appPort": 8992,
    "minify": ["prd", "stg"],
    "environments": ["dev", "int", "stg", "prd"],
    "controlServers": [
        "http://prd-tagserver001.mydomain.com:8080",
        "http://prd-tagserver002.mydomain.com:8080",
        "http://prd-tagserver003.mydomain.com:8080"
    ],
    "cacheExpiresSeconds": 300,
    "etag": true,
    "git": {
        "type": "gitlabs",
        "token": "mysecrettoken",
        "host": "git.mydomain.com",
        "port": 443,
        "readApiPath": "/api/v3/projects/{id}/repository/files?file_path={path}{ref}",
        "getRepoInfoPath": "/api/v3/projects/{repoName}"
    },
    "database": {
        "type": "mysql",
        "host": "127.0.0.1",
        "port": 3306,
        "user": "root",
        "password": "",
        "database": "tms"
    }
}

Tag Entry
=========

* id: The primary key used to store this tag in the database.  Automatically generated.
* name: Friendly name of the tag entry
* repo: The path to the repo in gitlabs.
* path: Path to the file in the repo.
* enabled: when checked the tag will added to the build.
* ref: A reference.  Can be a commit number, tag or branch name.  Optional.  If not specified the latest commit on the default branch, usually master, will be used.
* comment: The comment for this history state.  Required when making changes.

Contributing Repositories
=========================

Repositories used should attempt to conform to the following rules.

* File should reference event emitter API specified below.

Event Emitter API
=================

API has four default events

* load
* close
* action
* view

To subscribe to these events use the following:

    tms.on('view', function(a, b, c){
        // function body
    });


To emit events use the following:

    tms.emit('view', a, b, c);

You can subscribe to and emit custom events.

a, b, c in the examples above represent custom event data sent to the subscribed tags.

The following common event methods are available:

* on, addListener, addEventListener
* once
* listeners
* removeListener, removeEventListener
* removeAll
* emit

_Some methods are given multiple names to ensure familiarity to all_

Helper Methods
==============

The following helper methods are also part of the `tms` global object:
  
DOM
===

* createIframe(src);
* createPixel(src);
* createScript(src);

Cookies
=======

* getItem(cookieName);
* setItem(cookieName, cookieValue, vEnd, sPath, sDomain, bSecure);
* hasItem(cookieName);

Querystring
===========
* getQueryString();

Returns an object representing the querystring key value pairs.


The MIT License (MIT)

Copyright (c) 2014 Tony Germaneri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.