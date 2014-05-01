(function(){
    var x,
    tms = {
        events: {
            load: [],
            close: [],
            view: [],
            action: []
        },
        onceCheck: {},
        /**
        * Returns all listeners for the specified event.
        * @function
        * @type Function
        * @name listeners
        * @memberOf tms
        * @param {String} eventName Name of the event.
        * @public
        * @example <caption>Fetch listeners from the view event.</caption>
        * var x = tms.listeners('view');
        */
        listeners: function(event){
            return tms.eventControl('listeners', event);
        },
        /**
        * Removes all listeners from the specified event.
        * @function
        * @type Function
        * @name removeAll
        * @memberOf tms
        * @param {String} eventName Name of the event to remove listeners from.
        * @public
        * @example <caption>Remove all listeners from the view event.</caption>
        * var x = tms.removeAll('view');
        */
        removeAll: function(event){
            tms.eventControl('removeAll', event);
        },
        /**
        * Adds a function to an event.  When the event occurs the function will execute in the context of the event.
        * @function
        * @type Function
        * @name addEventListener
        * @memberOf tms
        * @param {String} eventName The name of the event, such as 'view', 'action' or 'load'.
        * @param {Function} procedure] The function to execute when the event occurs.
        * @throws {Exception} If the event name cannot be found.
        * @public
        * @example <caption>Add a listener to the view event.</caption>
        * var x = tms.on('view', function(a, b, c){
        *     // do some stuff 
        * });
        */
        /**
        * @borrows addEventListener as on
        */
        /**
        * @borrows addEventListener as addListener
        */
        on: function(event, listener){
            tms.eventControl('on', event, listener);
        },
        /**
        * Adds a function to an event.  When the event occurs the function will execute once, then un-subscribe from the event.
        * @function
        * @type Function
        * @name once
        * @memberOf tms
        * @param {String} eventName The name of the event, such as 'view', 'action' or 'load'.
        * @param {Function} procedure The function to execute when the event occurs.
        * @throws {Exception} If the event name cannot be found.
        * @public
        * @example <caption>Add a listener to the view event that will only execute once.</caption>
        * var x = tms.once('view', function(a, b, c){
        *     // do some stuff 
        * });
        */
        once: function(event, listener){
            tms.eventControl('once', event, listener);
        },
        /**
        * Removes a specified listener from a specified event.
        * @function
        * @type Function
        * @name removeEventListener
        * @memberOf tms
        * @param {String} eventName The event name to which the listener belongs.
        * @param {Function} procedure The function to to be removed.  Must be an actual reference to the function.
        * @throws {Exception} If the event name cannot be found.
        * @public
        * @example <caption>Add a listener to the view event that will only execute once.</caption>
        * var x = tms.once('view', function(a, b, c){
        *     // do some stuff 
        * });
        */
        /**
        * @borrows removeEventListener as removeListener
        */
        removeListener: function(event, listener){
            tms.eventControl('remove', event);
        },
        /**
        * Used to execute all event listeners of the specified event.
        * @function
        * @type Function
        * @name emit
        * @memberOf tms
        * @param {String} [eventName] Name of the event to execute.
        * @param {Object} [Array] an array of arguments to pass to the event listeners.
        * @public
        */
        emit: function(event){
            tms.eventControl('emit', event, undefined, arguments);
        },
        eventControl: function(operation, event, listener, eventArgs){
            if(tms.events[event] === undefined){
                throw new Error("Cannot find the event " + event);
            }
            if(operation === 'on'){
                tms.events[event].push(listener);
                return;
            }else if(operation === 'once'){
                tms.events[event].push(listener);
                tms.onceCheck[event].push(listener);
                return;
            }else if(operation === 'listeners'){
                return tms.events[event];
            }else if(operation === 'removeAll'){
                tms.events[event] = [];
                return;
            }
            var l = tms.events[event].length,
                e,
                x,
                i;
            for(x = 0;x < l;x++){
                if(operation === 'emit'){
                    e = tms.events[event][x];
                    i = tms.onceCheck[event].indexOf(e);
                    try{
                        Array.prototype.splice.call(eventArgs, 0, 1);
                        e.apply(tms, eventArgs);
                    }catch(err){
                        console.log(err);
                    }
                    if(i !== -1){
                        tms.onceCheck[event].splice(i, 1);
                        tms.events[event].splice(x, 1);
                    }
                }else if(operation === 'remove'){
                    if(listener === tms.events[event][x]){
                        tms.events.splice(x, 1);
                        break;
                    }
                }
            }
        },
        /**
        * Creates an iFrame tag with a specific src and hides it.  
        * Can optionally send tracking data in the second argument.
        * @function
        * @type Function
        * @name createIframe
        * @memberOf tms
        * @param {String} src The source (src) url for this tag.
        * @param {String} [trackingObj] The tracking data for this tag to be submitted to internal tracking.
        * @param {String} [trackingObj.partnerName] The name of this partner and or campaign.  E.g.: Swagbucks, cactus etc..
        * @param {String} [trackingObj.targetEvent] The event this tag is being created for.  E.g.: registration, add_cc, etc..
        * @returns {Object} undefined
        * @public
        * @example <caption>Create a tag and track it.</caption>
        * tms.createIframe('https://p.liadm.com/p?c=3582', {
        *     partnerName: 'ZeetoMedia',
        *     targetEvent: 'cc_added'
        * });
        */
        createIframe: function (src, trackingObj) {
            'use strict';
            var i = document.createElement('iframe');
            i.src = src;
            i.style.visibility = 'hidden';
            i.style.display = 'none';
            document.body.appendChild(i);
            if (trackingObj) {
                trackingObj.resourceType = 'iframe';
                trackingObj.trackedResourceUrl = src;
                tms.track(trackingObj);
            }
        },
        /**
        * Creates an image tag with a specific src.  
        * Can optionally send tracking data in the second argument.
        * @function
        * @type Function
        * @name createPixel
        * @memberOf tms
        * @param {String} src The source (src) url for this tag.
        * @param {String} [trackingObj] The tracking data for this tag to be submitted to internal tracking.
        * @param {String} [trackingObj.partnerName] The name of this partner and or campaign.  E.g.: Swagbucks, cactus etc..
        * @param {String} [trackingObj.targetEvent] The event this tag is being created for.  E.g.: registration, add_cc, etc..
        * @returns {Object} undefined
        * @public
        * @example <caption>Create a tag and track it.</caption>
        * tms.createPixel('https://p.liadm.com/p?c=3582', {
        *     partnerName: 'ZeetoMedia',
        *     targetEvent: 'cc_added'
        * });
        */
        createPixel: function (src, trackingObj) {
            'use strict';
            var i = document.createElement('img');
            i.style.display = 'none';
            i.style.visibility = 'hidden';
            i.src = src;
            document.body.appendChild(i);
            if (trackingObj) {
                trackingObj.resourceType = 'pixel';
                trackingObj.trackedResourceUrl = src;
                tms.track(trackingObj);
            }
        },
        /**
        * Creates an script tag with a specific src.  
        * Can optionally send tracking data in the second argument.
        * @function
        * @type Function
        * @name createScript
        * @memberOf tms
        * @param {String} src The source (src) url for this tag.
        * @param {String} [trackingObj] The tracking data for this tag to be submitted to internal tracking.
        * @param {String} [trackingObj.partnerName] The name of this partner and or campaign.  E.g.: Swagbucks, cactus etc..
        * @param {String} [trackingObj.targetEvent] The event this tag is being created for.  E.g.: registration, add_cc, etc..
        * @returns {Object} undefined
        * @public
        */
        createScript: function (src, trackingObj) {
            'use strict';
            var n = document.createElement('script'),
                s = document.getElementsByTagName("script")[0];
            n.type = 'text/javascript';
            n.async = true;
            n.src = src;
            s.parentNode.insertBefore(n, s);
            if (trackingObj) {
                trackingObj.resourceType = 'script';
                trackingObj.trackedResourceUrl = src;
                tms.track(trackingObj);
            }
        },
        /**
        * Creates a tracking confirmation pixel.
        * This can be called by the createXXXX function.
        * Calling this function directly shouldn't be necessary.
        * @function
        * @type Function
        * @name track
        * @memberOf tms
        * @param {String} trackingObj The tracking data to be submitted to internal tracking.
        * @param {String} trackingObj.partnerName The name of this partner and or campaign.  E.g.: Swagbucks, cactus etc..
        * @param {String} trackingObj.targetEvent The event this tag is being created for.  E.g.: registration, add_cc, etc..
        * @param {String} trackingObj.resourceType The resource type being tracked.  E.g.: img, iframe, script etc..
        * @param {String} trackingObj.trackedResourceUrl The URL used in the tracked resource.
        * @returns {Object} undefined
        * @public
        */
        track: function (obj) {
            'use strict';
            var p = (location.origin + '/log/v1/tracking/pxt/:partnerName/:resourceType/:targetEvent/:trackedResourceUrl/:profileId/:sessionId').
                replace(':partnerName', obj.partnerName || '').
                replace(':resourceType', obj.resourceType || '').
                replace(':targetEvent', obj.targetEvent || '').
                replace(':trackedResourceUrl', encodeURIComponent(obj.trackedResourceUrl)).
                replace(':profileId', tms.getProfileId()).
                replace(':sessionId', tms.getSessionId());
            tms.createPixel(p);
        },
        /**
        * Gets a cookie value.
        * @function
        * @type Function
        * @name getItem
        * @memberOf tms
        * @param {String} sKey The key name you want to see the value of.
        * @returns {String} Value of the cookie or null if the cookie does not exist.
        * @public
        */
        getItem: function (sKey) {
            'use strict';
            return unescape(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
        },
        /**
        * Sets a cookie value.
        * @function
        * @type Function
        * @name setItem
        * @memberOf tms
        * @param {String} sKey The key name of the value you want to set.
        * @param {String} sValue The value of the key specified in the first argument.
        * @param {Date} [vEnd] The date on which the cookie expires.
        * @param {String} [sPath] The path attribute for the cookie.
        * @param {String} [sDomain] The domain attribute for the cookie.
        * @param {Boolean} [bSecure] When true, then the secure attribute is set true.
        * @returns {Boolean} Always returns true no matter what.
        * @public
        */
        setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
            'use strict';
            if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return false; }
            vEnd = vEnd || new (Date()).setDate((new Date()).getDate()+365);
            var sExpires = "; expires=" + vEnd.toGMTString();
            document.cookie = escape(sKey) + "=" + escape(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
            return true;
        },
        /**
        * Checks if a cookie exists
        * @function
        * @type Function
        * @name hasItem
        * @memberOf tms
        * @param {String} sKey The key name of cookie you want to check for.
        * @returns {Boolean} Returns true if the cookie exists, otherwise false.
        * @public
        */
        hasItem: function (sKey) {
            'use strict';
            return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
        },
        /**
        * Gets the user's session id cookie.
        * @function
        * @type Function
        * @name getSessionId
        * @memberOf tms
        * @public
        * @returns {String} The session id cookie - if it exists, otherwise empty string.
        */
        getSessionId: function () {
            'use strict';
            return tms.getItem('MGO_analytics_sessionId');
        },
        /**
        * Gets the user's profile id from the local storage.
        * @function
        * @type Function
        * @name getProfileId
        * @memberOf tms
        * @public
        * @returns {String} The profile id from local storage - if it exists, otherwise empty string.
        */
        getProfileId: function () {
            'use strict';
            var profileId = '';
            try {
                profileId = JSON.parse(localStorage.getItem('token')).profile_id;
            } catch (ignore) {}
            return profileId || 'guest';
        },
        /**
        * Gets a transaction id.  (profile id + unix time).
        * @function
        * @type Function
        * @name getTransactionId
        * @memberOf tms
        * @public
        * @returns {String} The profile id from local storage - if it exists, otherwise empty string.
        */
        getTransactionId: function () {
            'use strict';
            var profileId = '';
            try {
                profileId = JSON.parse(localStorage.getItem('token')).profile_id + (new Date()).getTime();
            } catch (ignore) {}
            return profileId;
        },
        /**
        * Gets and object that represents the key value pairs that make up the querystring.
        * @function
        * @type Function
        * @name getQueryString
        * @memberOf tms
        * @public
        * @returns {String} The querystring object.
        */
        getQueryString: function () {
            'use strict';
            if(window.location.search === '' || window.location.search === undefined || window.location.search === null){
                return {};
            }
            if (this.location === window.location.search) {
                return this.cache;
            }
            var s = window.location.search.substring(1).split('&'),
                z = {},
                x,
                u;
            for (x = 0; x < s.length; x++) {
                u = s[x].split('=');
                z[u[0]] = u[1];
            }
            this.location = window.location.search;
            this.cache = z;
            return z;
        }
    };
    // create event named methods "view", "action" etc. as shortcuts for emit('blah')
    // and create arrays for "onceCheck" object
    for(x in tms.events){
        if(tms.events.hasOwnProperty(x)){
            tms.onceCheck[x] = [];
            (function(x){
                tms[x] = function(){
                    Array.prototype.splice.call(arguments, 0, 0, x);
                    tms.emit.apply(tms, arguments);
                };
            }(x));
        }
    }
    tms.removeEventListener = tms.removeListener;
    tms.addListener = tms.addEventListener = tms.on;
    window.utag = window.utag || {};
    window.utag.tms = tms;
    window.tms = tms;
    document.addEventListener('DOMContentLoaded', tms.load);
    /***BOUNDARY***/
}());