Vestigium Tag Management System
==========================

An open source enterprise tag management. It is meant to be a replacement for Tealium, TMS etc.

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
        "environments": ["prd","dev","stg","int"],
        "git": {
            "type": "gitlabs",
            "token": "blahblahblah",
            "host": "git.mysite.com",
            "port": 443,
            "path": "/api/v3/projects/{id}/repository/files?file_path={path}{ref}"
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

* id: The primary key used to store this tag in the database.
* repoid: The ID of the repo in gitlabs.
* url: The URL to the project.  Not used by the system, but good to have.
* enabled: when checked the tag will added to the build.
* path: The path to the file.
* ref: A reference.  Can be a commit number, tag or branch name.  Optional.  If not specified the latest commit on the default branch, usually master, will be used.
* comment: The comment for this history state.

Contributing Repositories
=========================

Repositories used must conform to the following rules.

* File should reference event emitter API specified below.

Event Emitter API
=================

API has four events

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

Or

    tms.view(a, b, c);

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

* createIframe(src, trackingObject);
* createPixel(src, trackingObject);
* createScript(src, trackingObject);
* track(trackingObject);
* getItem(cookieName);
* setItem(cookieName, cookieValue, vEnd, sPath, sDomain, bSecure);
* hasItem(cookieName);
* getSessionId();
* getProfileId();
* getQueryString();

