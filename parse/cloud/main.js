var _ = require('underscore');
var sleep = require('sleep');
var oauth = require("cloud/libs/oauth.js");


if (typeof Parse === 'undefined') {
    var Parse = require('parse-cloudcode-runner').Parse;
    Parse.initialize(process.env.PARSE_APPLICATION_ID, process.env.PARSE_JAVASCRIPT_KEY, process.env.PARSE_MASTER_KEY);
}

/**
 * Twitter Object constructor.
 *
 * @param params
 * @constructor
 */
var Twitter = function (params) {

    this.tableName = params.tableName;

    this.screenNames = params.screenNames;

    this.tweetsPerPage = params.tweetsPerPage;

    this.tweetsPerSearchPage = params.tweetsPerSearchPage;

    this.maxQueryTweets = params.maxQueryTweets;

    this.mentionsTable = params.mentionsTable;

    this.timelineTable = params.timelineTable;

    // Setup twitter app keys for Twitter API
    this.consumerSecret = params.consumerSecret;
    this.oauth_consumer_key = params.oauth_consumer_key;
    this.tokenSecret = params.tokenSecret;
    this.oauth_token = params.oauth_token;

    this.ts = new Date().getTime() / 1000;
    this.timestamp = Math.floor(this.ts).toString();

    this.twitterAccessor = {
        consumerSecret: this.consumerSecret,
        tokenSecret: this.tokenSecret
    };

    // Metrics counter
    this.counters = {
        totalTweets: 0,
        totalFavorited: 0,
        totalRetweeted: 0,
        originalTweets: 0,
        totalReplies: 0,
        totalRetweets: 0,
        totalReplied: 0,
        totalMetioned: 0,
        totalOriginalMetioned: 0,
        totalOriginalSharedTwitter: 0,
        totalOriginalSharedOther: 0,
        totalSharedTwitter: 0,
        totalSharedOther: 0
    };

    this.data = [];
    this.mentionedTweets = [];
    this.tweets = [];
    this.test = [];

};

Twitter.prototype = {

    // Implementation of Twitter oauth authentication
    initializeApi: function (url) {

        var urlLink = url;

        // Setup shared vars for Twitter API
        var nonce = oauth.nonce(32);

        var twitterParams = {
            oauth_version: "1.0",
            oauth_consumer_key: this.oauth_consumer_key,
            oauth_token: this.oauth_token,
            oauth_timestamp: this.timestamp,
            oauth_nonce: nonce,
            oauth_signature_method: "HMAC-SHA1"
        };

        var message = {
            method: "GET",
            action: urlLink,
            parameters: twitterParams
        };

        oauth.SignatureMethod.sign(message, this.twitterAccessor);

        var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
        var encodedSig = oauth.percentEncode(sig);

        return 'OAuth oauth_consumer_key="' + this.oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + this.timestamp + ',oauth_token="' + this.oauth_token + '", oauth_version="1.0"';

    },

    /**
     * getIncrementSinceId
     *
     * since id is a big number in string format, ex: 654328939449848
     *
     * we want to make this number add integer 1 and get newer timestring.
     *
     * @param sinceId
     * @returns {string}
     */
    getIncrementSinceId: function (sinceId) {

        var i, currentDigit,
            index = 1,
            borrowDigit = true,
            length = sinceId.length;

        function setCharAt(str, index, chr) {

            if (index > str.length - 1) {
                return str;
            }

            return str.substr(0, index) + chr + str.substr(index + 1);
        }

        while (borrowDigit) {

            i = length - index;
            currentDigit = sinceId[i];
            currentDigit = parseInt(currentDigit) + 1;

            if (currentDigit < 10) {

                borrowDigit = false;
                sinceId = setCharAt(sinceId, i, currentDigit.toString());

                continue;
            }

            sinceId = setCharAt(sinceId, i, "0");
            index += 1;
        }

        return sinceId;
    },


    /**
     * getDecrementMaxId
     *
     * max id is a big number in string format, ex: 654328939449848
     *
     * we want to make this number minus integer 1 and get older timestring.
     *
     * @param sinceId
     * @returns {string}
     */
    getDecrementMaxId: function (maxIdStr) {

        var i, currentDigit,
            index = 1,
            borrowDigit = true,
            length = maxIdStr.length;

        function setCharAt(str, index, chr) {

            if (index > str.length - 1) {
                return str;
            }

            return str.substr(0, index) + chr + str.substr(index + 1);
        }

        while (borrowDigit) {

            i = length - index;
            currentDigit = maxIdStr[i];
            currentDigit = parseInt(currentDigit) - 1;

            if (currentDigit >= 0) {

                borrowDigit = false;
                maxIdStr = setCharAt(maxIdStr, i, currentDigit.toString());

                continue;
            }

            maxIdStr = setCharAt(maxIdStr, i, "0");
            index += 1;
        }

        return maxIdStr;
    },

    /**
     * queryUserTimelineApiCallback
     *
     * pair function with, `queryUserTimelineApi`, make a recursive call to `queryUserTimelineApi` if more tweets need to be query next.
     *
     * @param recordLength
     * @param nextMaxId
     * @param screenName
     * @param promise
     * @returns {*}
     */
    queryUserTimelineApiCallback: function (recordLength, nextMaxId, screenName, promise) {

        if (this.counters.totalTweets <= this.maxQueryTweets && recordLength > 0) {

            return this.queryUserTimelineApi(nextMaxId, screenName, promise);

        }
        else {

            //console.log("RecordLength: " + recordLength);

            // When there's no further page left
            this.data[screenName].favorited = this.counters.totalFavorited;
            this.data[screenName].retweeted = this.counters.totalRetweeted;
            this.data[screenName].replies = this.counters.totalReplies;
            this.data[screenName].tweets = this.counters.originalTweets - this.counters.totalReplies;
            this.data[screenName].retweets = this.counters.totalRetweets;
            this.data[screenName].totalTweets = this.counters.totalTweets;

            //console.log((new Date().getTime() / 1000) + " " + JSON.stringify(this.data[screenName]));

            return Parse.Promise.as();
            //promise.resolve();
        }

    },

    /**
     * queryUserTimelineApi
     *
     * called by performUserTweetsAnalytics, search for tweets by input screenName
     *
     * @param maxId
     * @param screenName
     * @param promise
     * @returns {promise}
     */
    queryUserTimelineApi: function (maxId, screenName, promise) {

        var that = this;

        //var promise = promise || new Parse.Promise();

        // Initialize max_id
        maxId = maxId || 0;

        // Prepare concatenating for max_id query string
        var maxIdStr = (maxId === 0) ? '' : '&max_id=' + maxId;

        var url = "https://api.twitter.com/1.1/statuses/user_timeline.json?include_rts=1&screen_name=" + screenName + "&count=" + that.tweetsPerPage + maxIdStr;

        var apiAuthorizationHeaders = that.initializeApi(url);

        return Parse.Cloud.httpRequest({
            method: "GET",
            url: url,
            headers: {
                Authorization: apiAuthorizationHeaders
            }}).then(function (httpResponse) {
                var i, nextMaxId = 0;

                var results = JSON.parse(httpResponse.text);

                that.counters.totalTweets += results.length;

                for (i = 0; i < results.length; i++) {

                    // Calculating metrics
                    if (typeof(results[i].retweeted_status) === 'undefined') {
                        that.counters.totalFavorited += results[i].favorite_count;
                        that.counters.totalRetweeted += results[i].retweet_count;
                        that.counters.originalTweets += 1;

                        // Saving tweets to data object
                        that.data[screenName].tweetsDetails.push(results[i]);
                    } else {
                        that.counters.totalRetweets += 1;
                    }

                    if (results[i].in_reply_to_screen_name !== null) {
                        that.counters.totalReplies += 1;
                    }

                }

                // Search for older tweets
                if (results.length !== 0) {
                    nextMaxId = that.getDecrementMaxId(results[results.length - 1].id_str);
                }

                return that.queryUserTimelineApiCallback(results.length, nextMaxId, screenName, promise);
            },
            function (httpResponse) {
                console.log("Twitter API error code: " + httpResponse.status);
                console.log(JSON.stringify(httpResponse));
            });

        //return promise;
    },

    /**
     * performUserTweetsAnalytics
     *
     * @returns {Promise}
     */
    performUserTweetsAnalytics: function () {

        var that = this;

        var promise = Parse.Promise.as();

        _.each(that.screenNames, function (screenName) {

            promise = promise.then(function () {

                // Reset all counters
                for (var key in that.counters) {
                    that.counters[key] = 0;
                }

                console.log((new Date().getTime() / 1000) + " performUserTweetsAnalytics ScreenName: " + screenName);

                return that.queryUserTimelineApi(null, screenName);

            }); // promise

        }); // _.each

        return promise;

    },

    /**
     * getFormatedMention
     *
     * get populated data of mention object
     *
     * @param data
     * @param name
     * @returns {*}
     */
    getFormatedMention: function (data, name) {

        var mentioningPrototype = Parse.Object.extend(this.mentionsTable);

        var mention = new mentioningPrototype();

        mention.set("created_at", data.created_at);
        mention.set("id_str", data.id_str);
        mention.set("text", data.text);
        mention.set("source", data.source);
        mention.set("mentioning", name);
        mention.set("in_reply_to_screen_name", data.in_reply_to_screen_name);

        mention.set("in_reply_to_status_id", data.in_reply_to_status_id);
        mention.set("in_reply_to_status_id_str", data.in_reply_to_status_id_str);
        mention.set("in_reply_to_user_id", data.in_reply_to_user_id);
        mention.set("in_reply_to_user_id_str", data.in_reply_to_user_id_str);
        mention.set("in_reply_to_screen_name", data.in_reply_to_screen_name);

        mention.set("user_id_str", data.user.id_str);
        mention.set("user_screen_name", data.user.screen_name);
        mention.set("user_location", data.user.location);

        mention.set("entities_hashtags", JSON.stringify(data.entities.hashtags));
        mention.set("entities_user_mentions", JSON.stringify(data.entities.user_mentions));
        mention.set("entities_urls", JSON.stringify(data.entities.urls));
        mention.set("entities_media", JSON.stringify(data.entities.media));

        return mention;

    },

    /**
     * querySearchApiCallback
     *
     * pair with querySearchApi, recursively call querySerchApi if more tweets left. Else resolve promise.
     *
     * @param direction
     * @param recordLength
     * @param nextMaxId
     * @param nextSinceId
     * @param screenName
     * @param promise
     * @returns {*|Parse.Promise}
     */
    querySearchApiCallback: function (direction, recordLength, nextMaxId, nextSinceId, screenName, promise) {

        if (this.counters.totalTweets <= this.maxQueryTweets && recordLength > 0) {

            //console.log("RecordLength: " + recordLength);

            return this.querySearchApi(direction, nextMaxId, nextSinceId, screenName, promise);
        }
        else {

            console.log("RecordLength: " + this.counters.totalTweets);

            //console.log((new Date().getTime() / 1000) + " " + JSON.stringify(this.data[screenName]));

            promise.resolve();
        }
    },

    /**
     * querySearchApi
     *
     * search for tweets of particular user(screenName), include_entities means including media information.
     *
     * @param direction
     * @param maxId
     * @param sinceId
     * @param screenName
     * @param promise
     * @returns {*|Parse.Promise}
     */
    querySearchApi: function (direction, maxId, sinceId, screenName, promise) {

        var that = this;

        var promise = promise || new Parse.Promise();

        // Initialize max_id
        maxId = (maxId == null) ? '' : maxId;
        sinceId = (sinceId == null) ? '' : sinceId;

        // Prepare concatenating for max_id query string
        var maxIdStr = (maxId === '') ? '' : '&max_id=' + maxId;
        var sinceIdStr = (sinceId === '') ? '' : '&since_id=' + sinceId;

        var url = "https://api.twitter.com/1.1/search/tweets.json?q=" + encodeURIComponent("@") + screenName + "&count=" + that.tweetsPerSearchPage + maxIdStr + sinceIdStr + "&include_entities=true";

        var apiAuthorizationHeaders = that.initializeApi(url);

        Parse.Cloud.httpRequest({
            method: "GET",
            url: url,
            headers: {
                Authorization: apiAuthorizationHeaders
            },
            success: function (httpResponse) {

                var i, nextMaxId = null, nextSinceId = null;
                var results = JSON.parse(httpResponse.text).statuses;
                var data = that.mentionedTweets;

                //console.log(results.length);

                for (i = 0; i < results.length; i++) {

                    that.counters.totalTweets += 1;

                    //console.log(results[i].entities.urls);

                    data.push(that.getFormatedMention(results[i], screenName));

                }

                if (results.length !== 0 && direction === 'backward') {
                    nextMaxId = that.getDecrementMaxId(results[results.length - 1].id_str);

                    //console.log("Next Max Id: " + nextMaxId);
                }
                else if (results.length !== 0 && direction === 'forward') {
                    nextSinceId = that.getIncrementSinceId(results[0].id_str);

                    //console.log("Next Since Id: " + nextSinceId);
                }

                return that.querySearchApiCallback(direction, results.length, nextMaxId, nextSinceId, screenName, promise);

            },
            error: function (httpResponse) {
                console.log("Twitter API error code: " + httpResponse.status);

                promise.reject(JSON.stringify(httpResponse));
            }
        }); // httpRequest

        return promise;

    },

    performMentioningSearch: function (direction) {

        var that = this;

        var promise = Parse.Promise.as();

        direction = direction || "backward";

        if (["forward", "backward"].indexOf(direction) === -1) {
            return promise;
        }

        _.each(that.screenNames, function (screenName) {

            promise = promise.then(function () {

                // Reset all counters
                for (var key in that.counters) {
                    that.counters[key] = 0;
                }

                console.log((new Date().getTime() / 1000) + " performMentioningSearch ScreenName: " + screenName);

                return Parse.Promise.as(screenName).then(function (name) {

                    var mentioningPrototype = Parse.Object.extend(that.mentionsTable);
                    var query = new Parse.Query(mentioningPrototype);

                    if (direction == "forward") {
                        query.descending("id_str");
                    }
                    else {
                        query.ascending("id_str");
                    }

                    query.equalTo("mentioning", name);
                    query.limit(1);

                    return query.find().then(function (result) {

                        var idStr = '';

                        var idHandler = {
                            maxId: null,
                            sinceId: null
                        };

                        if (result.length !== 0) {
                            idStr = result[0].get("id_str");

                            //console.log("Indexing id_str for " + name + " : " + idStr);

                            if (direction === "forward") {
                                idHandler.sinceId = that.getIncrementSinceId(idStr);
                            }
                            else {
                                idHandler.maxId = that.getDecrementMaxId(idStr);
                            }
                        }

                        return Parse.Promise.as(idHandler);

                    });

                }).then(function (idHandler) {

                    if (idHandler.maxId == null && idHandler.sinceId == null) {
                        return Parse.Promise.as();
                    }

                    return that.querySearchApi(direction, idHandler.maxId, idHandler.sinceId, screenName, null).then(function () {
                        return Parse.Promise.as();
                    });

                });

            }); // promise

        }); // _.each

        return promise;

    },

    /**
     * initDataObject
     *
     * @param name
     */
    initDataObject: function (name) {

        this.data[name] = {
            screen_name: '',
            following: '',
            followers: '',
            favorites: '',
            favorited: '',
            listed: '',
            tweets: '',
            replies: '',
            retweets: '',
            retweeted: '',
            totalTweets: '',
            metioned: '',
            replied: '',
            shared: '',
            tweetsDetails: []
        };

    },

    /**
     * performScreenNamesLookup
     *
     * get users' information
     *
     * @returns {*}
     */
    performScreenNamesLookup: function () {

        var that = this;

        var url = "https://api.twitter.com/1.1/users/lookup.json?screen_name=" + this.screenNames.join();

        var apiAuthorizationHeaders = that.initializeApi(url);

        return Parse.Cloud.httpRequest({
            method: "GET",
            url: url,
            headers: {
                Authorization: apiAuthorizationHeaders
            },
            success: function (httpResponse) {

                var i, name;

                var data = that.data;

                var results = JSON.parse(httpResponse.text);

                for (i = 0; i < results.length; i++) {

                    name = results[i].screen_name.toLowerCase();

                    if (!(name in data)) {
                        that.initDataObject(name);
                    }

                    data[name].screen_name = results[i].screen_name.toLowerCase();
                    data[name].following = results[i].friends_count;
                    data[name].followers = results[i].followers_count;
                    data[name].favorites = results[i].favourites_count;
                    data[name].listed = results[i].listed_count;

                }

            },
            error: function (httpResponse) {
                console.log('Request failed with response code ' + JSON.stringify(httpResponse));
            }
        }); // httpRequest
    },

    /**
     * savingUserTimelineStatus
     *
     * @returns {*}
     */
    savingUserTimelineStatus: function () {

        var that = this;

        var promise = Parse.Promise.as(0);

        var i;

        for (i = 0; i < that.screenNames.length; i++) {

            promise = promise.then(function (k) {

                var name = that.screenNames[k];

                console.log((new Date().getTime() / 1000) + " \Saving timeline: " + name);

                var userTimelinePrototype = Parse.Object.extend(that.timelineTable);

                var user = new userTimelinePrototype();

                user.set("screen_name", that.data[name].screen_name);
                user.set("following", that.data[name].following ? that.data[name].following : 0);
                user.set("followers", that.data[name].followers ? that.data[name].followers : 0);
                user.set("favorites", that.data[name].favorites ? that.data[name].favorites : 0);
                user.set("favorited", that.data[name].favorited ? that.data[name].favorited : 0);
                user.set("listed", that.data[name].listed ? that.data[name].listed : 0);
                user.set("tweets", that.data[name].tweets ? that.data[name].tweets : 0);
                user.set("replies", that.data[name].replies ? that.data[name].replies : 0);
                user.set("retweets", that.data[name].retweets ? that.data[name].retweets : 0);
                user.set("retweeted", that.data[name].retweeted ? that.data[name].retweeted : 0);
                user.set("totalTweets", that.data[name].totalTweets ? that.data[name].totalTweets : 0);

                user.set("replied", that.data[name].totalReplied ? that.data[name].totalReplied : 0);

                user.set("mentioned", that.data[name].totalMetioned ? that.data[name].totalMetioned : 0);
                user.set("original_mentioned", that.data[name].totalOriginalMetioned ? that.data[name].totalOriginalMetioned : 0);

                user.set("shared_twitter", that.data[name].totalSharedTwitter ? that.data[name].totalSharedTwitter : 0);
                user.set("shared_other", that.data[name].totalSharedOther ? that.data[name].totalSharedOther : 0);

                user.set("original_shared_twitter", that.data[name].totalOriginalSharedTwitter ? that.data[name].totalOriginalSharedTwitter : 0);
                user.set("original_shared_other", that.data[name].totalOriginalSharedOther ? that.data[name].totalOriginalSharedOther : 0);

                user.set("historicalRetweet", that.data[name].historicalRetweet ? that.data[name].historicalRetweet : 0);
                user.set("historicalFavorite", that.data[name].historicalFavorite ? that.data[name].historicalFavorite : 0);

                user.set("oldestIdStrOfCurrentSearchWindow", that.data[name].oldestIdStrOfCurrentSearchWindow ? that.data[name].oldestIdStrOfCurrentSearchWindow : 0);
                user.set("newestIdStrOfCurrentSearchWindow", that.data[name].newestIdStrOfCurrentSearchWindow ? that.data[name].newestIdStrOfCurrentSearchWindow : 0);

                return user.save().then(function (objs) {

                    console.log((new Date().getTime() / 1000) + " Saved " + name + " timeline.");

                    return Parse.Promise.as(k + 1);

                }, function (e) {

                    console.error(e);

                });

            });
        }

        return promise;
    },

    /**
     * assignExistedTweetObjectId
     *
     * search if tweet existed, if true, assigning parse objectId to it before save.
     *
     * @param name
     */
    assignExistedTweetObjectId: function (name) {

        var that = this;
        var tweetsPrototype = Parse.Object.extend("Tweets");
        var skipStep = 1000;

        var queryCallback = function (length, date) {

            //console.log("In callback: length: " + length + ", skip: " + skip);

            if (length === skipStep) {
                return doQuery(date);
            }
            else {
                return Parse.Promise.as();
            }

        };

        var doQuery = function (date) {

            var i, j;
            var query = new Parse.Query(tweetsPrototype);

            query.select("objectId", "id_str", "screen_name");
            query.equalTo("screen_name", name);
            query.lessThan("createdAt", date);
            query.limit(1000);

            return query.find().then(function (results) {

                for (i = 0; i < results.length; i++) {
                    for (j = 0; j < that.length; j++) {
                        if (that[j].id_str === results[i].get("id_str")) {
                            that[j].objectId = results[i].id;
                        }
                    }
                }

                if (results.length != 0) {
                    date = results[results.length-1].get("createdAt");
                }

                return queryCallback(results.length, date);
            });

        };

        return doQuery(new Date());

    },

    /**
     * savingMentionsOnParse
     *
     * save all mentioning tweets
     *
     * @returns {*}
     */
    savingMentionsOnParse: function () {

        var that = this;
        var beforeSaveTs = new Date().getTime() / 1000;

        // Perform Saving
        return Parse.Object.saveAll(that.mentionedTweets, {

            success: function (objs) {

                console.log((new Date().getTime() / 1000) + " Saved " + objs.length);

            },
            error: function (e) {

                console.log("Saving tweets failed.");

                return Parse.Promise.as().reject("Saving tweets failed.");

            }

        }).then(function (objs) {

            var logPrototype = Parse.Object.extend("Logs");

            var log = new logPrototype();

            log.set("saving", objs.length);
            log.set("type", "mentions");
            log.set("time", Math.floor((new Date().getTime() / 1000 - beforeSaveTs)).toString());

            return Parse.Promise.as();

        });

    },

    /**
     * calculatingMentioning
     *
     * count the state of mentioned, replied, shared media metrics of tweets mentioned particular user(screenName)
     *
     * @returns {*}
     */
    calculatingMentioning: function () {

        var that = this;

        var promise = Parse.Promise.as();

        var mentioningPrototype = Parse.Object.extend(that.mentionsTable);

        var skipStep = 1000;

        _.each(that.screenNames, function (screenName) {

            promise = promise.then(function () {

                // Reset all counters
                for (var key in that.counters) {
                    that.counters[key] = 0;
                }

                console.log((new Date().getTime() / 1000) + " calculatingMentioning ScreenName: " + screenName);

                var queryCallback = function (length, date) {

                    console.log("In callback: length: " + length);

                    if (length === skipStep) {
                        return doQuery(date);
                    }
                    else {
                        that.data[screenName].totalReplied               = that.counters.totalReplied;
                        that.data[screenName].totalMetioned              = that.counters.totalMetioned;
                        that.data[screenName].totalOriginalMetioned      = that.counters.totalOriginalMetioned;
                        that.data[screenName].totalSharedTwitter         = that.counters.totalSharedTwitter;
                        that.data[screenName].totalSharedOther           = that.counters.totalSharedOther;
                        that.data[screenName].totalOriginalSharedTwitter = that.counters.totalOriginalSharedTwitter;
                        that.data[screenName].totalOriginalSharedOther   = that.counters.totalOriginalSharedOther;

                        return Parse.Promise.as();
                    }

                };

                var doQuery = function (date) {

                    var query = new Parse.Query(mentioningPrototype);

                    query.equalTo("mentioning", screenName);
                    query.lessThan("createdAt", date);
                    query.limit(1000);

                    return query.find().then(function (results) {

                        console.log((new Date().getTime() / 1000) + "mentioning result: " + results.length);

                        for (var i = 0; i < results.length; i++) {

                            if (results[i].get("user_screen_name") != screenName)
                            {
                                that.countMentioned(results[i]);
                                that.countReplied(results[i]);
                                that.countSharedTwitter(results[i]);
                                that.countSharedOther(results[i]);
                            }

                        }

                        return queryCallback(results.length, results[results.length-1].get("createdAt"));

                    }, function(e) {
                        console.log(JSON.stringify(e));
                    });

                };

                return doQuery(new Date());

            }).then(function () {
                //console.log("Replied: " + that.counters.totalReplied);
                //console.log("Mentioned: " + that.counters.totalMetioned);
                //console.log("Original Mentioned(Not Retweet): " + that.counters.totalOriginalMetioned);
                //console.log("Original Shared Other(Not Retweet): " + that.counters.totalOriginalSharedOther);
                //console.log("Original Shared Twitter(Not Retweet): " + that.counters.totalOriginalSharedTwitter);
                //console.log("Shared Twitter: " + that.counters.totalSharedTwitter);
                //console.log("Shared Other: " + that.counters.totalSharedOther);
                //console.log("------------------------------");
            }); // promise

        }); // _.each

        return promise;

    },

    /**
     * batchSavingRecords
     *
     * saving on parse can be tricky since we cannot exceeed the request/sec policy. Thus, we exploit setTimeout method
     * to sleep through enough time.
     *
     * @param data
     * @returns {*}
     */
    batchSavingRecords: function (data) {

        var that = this;
        var promise = Parse.Promise.as({"index": 0, "ts": (new Date).getTime()});

        var perBatch = 20;
        var threshold = 1000;

        pages = Math.floor(data.length / perBatch);
        pages = (data.length % perBatch) > 0 ? pages + 1 : pages;

        console.log((new Date().getTime() / 1000) + " Total Tweets: " + data.length);
        console.log((new Date().getTime() / 1000) + " Total Pages: " + pages);

        for (var i = 0 ; i < pages ; i++)
        {
            promise = promise.then(function (k) {

                var spliceAmount = data.length > perBatch ? perBatch : data.length;
                var dataToSave = data.splice(0, spliceAmount);
                var pagePromise = new Parse.Promise();

                Parse.Object.saveAll(dataToSave).then(
                    function (objs) {

                        var ts = (new Date).getTime();
                        var diff = ts - k.ts;

                        console.log("Diff:" + diff, k.index);

                        if (diff < threshold)
                        {
                            var toSleep = threshold - diff;

                            console.log(toSleep);

                            try
                            {
                                setTimeout(function(){

                                    console.log("Saved Page. " + k.index);

                                    pagePromise.resolve({"index": k.index+1, "ts": (new Date).getTime()});

                                }, toSleep);
                            }
                            catch (e) {
                                console.log(JSON.stringify(e));
                            }

                        }
                        else {
                            pagePromise.resolve({"index": k.index+1, "ts": (new Date).getTime()});
                        }

                }).then(function(length) {

                    return Parse.Promise.as(k+1);

                }, function(e) {

                    console.log(JSON.stringify(e));

                    return Parse.Promise.as().reject("Saving tweets failed.");

                });

                return pagePromise;

            });
        }

        return promise;

    },

    /**
     * queryOlderTweets
     *
     * read out the previous tweets
     *
     * @param name
     * @param maxId
     */
    queryOlderTweets: function(name, maxId)
    {
        var that = this;
        var tweetsPrototype = Parse.Object.extend("Tweets");
        var skipStep = 1000;
        var oldData = [];

        var queryCallback = function (length, date) {

            console.log("In callback: length: " + length );

            if (length === skipStep) {
                return doQuery(date);
            }
            else {
                return Parse.Promise.as(oldData);
            }

        };

        var doQuery = function (date) {

            var i, j;
            var query = new Parse.Query(tweetsPrototype);

            query.select("objectId", "id_str", "screen_name", "favorite_count", "retweet_count", "createdAt");
            query.equalTo("screen_name", name);
            query.lessThan("createdAt", date);
            query.limit(1000);

            return query.find().then(function (results) {

                _.each(results, function(d)
                {
                    if (d.get("id_str") < maxId)
                    {
                        oldData = oldData.concat(d);
                    }

                });

                console.log(results.length);

                if (results.length != 0) {
                    date = results[results.length-1].get("createdAt");
                }

                return queryCallback(results.length, date);
            }, function(e) {
                console.log(JSON.stringify(e));
            });

        };

        return doQuery(new Date());

    },

    /**
     * calculateHistoricalMetrics
     *
     * read out historical tweets and perform metrics calculation
     *
     * @returns {*}
     */
    calculateHistoricalMetrics: function()
    {
        var that = this;
        var promise = Parse.Promise.as(0);
        var n;

        for (n = 0; n < that.screenNames.length; n++) {

            promise = promise.then(function (nameIndex)
            {

                var name, length, data, maxId,
                    favorited_num = 0,
                    retweeted_num = 0;

                name = that.screenNames[nameIndex];
                length = that.data[name].tweetsDetails.length;

                if (length == 0)
                {
                    return Parse.Promise.as(nameIndex+1);
                }

                data = that.data[name].tweetsDetails;

                // sort id_str in "Ascending", before getting the search window boundry of id_str
                data.sort(function(a, b){
                    if(a.id_str < b.id_str)
                        return 1;

                    if(a.id_str > b.id_str)
                        return -1;

                    return 0;
                });

                // Set oldest id_str of current search window
                that.data[name].oldestIdStrOfCurrentSearchWindow = maxId = data[length - 1].id_str;
                that.data[name].newestIdStrOfCurrentSearchWindow = data[0].id_str;

                data.map(function(d)
                {
                    favorited_num += d.favorite_count;
                    retweeted_num += d.retweet_count;
                });

                return Parse.Promise.when(that.queryOlderTweets(name, maxId)).then(function(result) {

                    result.map(function(d)
                    {
                        favorited_num += d.get("favorite_count");
                        retweeted_num += d.get("retweet_count");
                    });

                    that.data[name].historicalRetweet = retweeted_num;
                    that.data[name].historicalFavorite = favorited_num;

                    return Parse.Promise.as(nameIndex+1);

                });

            });

        }

        return promise;
    },

    updateTweetsObjectId: function () {

        var tweetsPrototype = Parse.Object.extend("Tweets");
        var that = this;
        var promise = Parse.Promise.as(0);
        var n;

        for (n = 0; n < that.screenNames.length; n++) {

            promise = promise.then(function (nameIndex) {

                var name = that.screenNames[nameIndex];

                console.log(name);

                var length = that.data[name].tweetsDetails.length;

                console.log((new Date().getTime() / 1000) + " Prepare saving " + length + " tweets of - " + name);

                var i,
                    beforeSaveTs = new Date().getTime() / 1000,
                    tweets = [],
                    assignIdPromise;

                assignIdPromise = that.assignExistedTweetObjectId.call(that.data[name].tweetsDetails, name).then(function () {

                    for (i = 0; i < length; i++) {

                        // Collects tweets to push
                        var item = new tweetsPrototype();

                        item.id = that.data[name].tweetsDetails[i].objectId;

                        item.set("text", that.data[name].tweetsDetails[i].text);
                        item.set("source", that.data[name].tweetsDetails[i].source);
                        item.set("retweet_count", that.data[name].tweetsDetails[i].retweet_count);
                        item.set("created_at", that.data[name].tweetsDetails[i].created_at);
                        item.set("favorite_count", that.data[name].tweetsDetails[i].favorite_count);
                        item.set("retweeted", that.data[name].tweetsDetails[i].retweeted);
                        item.set("id_str", that.data[name].tweetsDetails[i].id_str);
                        item.set("entities", that.data[name].tweetsDetails[i].entities);
                        item.set("screen_name", name);

                        //console.log(that.data[name].tweetsDetails[i].favorite_count, that.data[name].tweetsDetails[i].objectId);
                        //console.log(item.get("favorite_count"));

                        tweets.push(item);
                    }

                    that.tweets = that.tweets.concat(tweets);

                    return Parse.Promise.as(nameIndex+1);

                });

                return assignIdPromise;

            }); // promise

        } // for loop

        return promise;

    },

    /**
     * countMentioned
     *
     * @param data
     */
    countMentioned: function (data) {

        if (data.get("in_reply_to_status_id") == null && data.get("in_reply_to_user_id") == null) {
            this.counters.totalMetioned += 1;

            if (data.get("text").indexOf("RT @") == -1)
            {
                this.counters.totalOriginalMetioned += 1;
            }
        }

    },

    /**
     * countReplied
     *
     * @param data
     */
    countReplied: function (data) {

        if (data.get("in_reply_to_status_id") || data.get("in_reply_to_user_id")) {
            this.counters.totalReplied += 1;
        }

    },

    /**
     * countSharedTwitter
     *
     * User upload image or video by twitter.
     *
     * @param data
     */
    countSharedTwitter: function (data) {

        // Calculate medias shared with Twitter Webapp
        if (data.get("entities_media")) {
            this.counters.totalSharedTwitter += 1;

            if (data.get("text").indexOf("RT @") == -1)
            {
                this.counters.totalOriginalSharedTwitter += 1;
            }
        }

    },

    /**
     * countSharedOther
     *
     * Other media resource, other than upload using twitter. Including resource like youtube, instagram, vimeo and vine.
     *
     * @param data
     */
    countSharedOther: function (data) {

        // Calculate medias shared with other services
        var urlsStr = typeof data.get("entities_urls") != "undefined" ? data.get("entities_urls") : "[]";
        var urls = JSON.parse(urlsStr);
        var b_mediaCounted = false;

        for (var url_i = 0; url_i < urls.length; url_i++)
        {
            if (urls[url_i].expanded_url.indexOf("youtube.com") >= 0 ||
                urls[url_i].expanded_url.indexOf("youtu.be")        >= 0 ||
                urls[url_i].expanded_url.indexOf("instagram.com")   >= 0 ||
                urls[url_i].expanded_url.indexOf("youtu.be")        >= 0 ||
                urls[url_i].expanded_url.indexOf("vimeo.com")       >= 0 ||
                urls[url_i].expanded_url.indexOf("vine.co")         >= 0 ) {

                this.counters.totalSharedOther += 1;

                if (data.get("text").indexOf("RT @") == -1)
                {
                    this.counters.totalOriginalSharedOther += 1;
                }
            }

            // Backward Compatible: some of the "entities_media" was stored in "entities_urls" column... It was previous mistake
            if (urls[url_i].type && !b_mediaCounted)
            {
                this.counters.totalSharedTwitter += 1;

                if (data.get("text").indexOf("RT @") == -1)
                {
                    this.counters.totalOriginalSharedTwitter += 1;
                }

                // Count only once for multiple images/videos
                b_mediaCounted = true;
            }

        }

    }

};

/**
 * JOB: twitterParser
 *
 * Parse users' timeline information by selected screen_name. Search users' tweets, performing favorited and retweeted
 * metrics. Search for mentioning and shared, save tweets on parse database.
 *
 * 1. performScreenNamesLookup
 *    API: https://api.twitter.com/1.1/users/lookup.json?screen_name={$screen_name}
 *    Purpose: User's information such as followers and tweets count etc..
 *
 * 2. performUserTweetsAnalytics
 *    API: https://api.twitter.com/1.1/statuses/user_timeline.json?include_rts=1&screen_name={$screen_name}
 *    Purpose: Calculated user's own tweets
 *
 * 3. performMentioningSearch
 *    API: https://api.twitter.com/1.1/search/tweets.json?q=foo
 *    Purpose: Search for tweets that mentioning current user
 *
 * 4. savingMentionsOnParse
 *    Purpose: Saved the cached tweets on Parse.
 *
 * 5. calculatingMentioning
 *    Purpose: Perform calculation.
 *
 * 6. savingUserTimelineStatus
 *    Purpose: Saving user timeline information.
 *
 * 7. updateTweetsObjectId
 *    Purpose: Update rest of the information such as favorite_count and retweet_count
 *
 * 8. batchSavingRecords
 *    Purpose: Save all the new tweets by the query user(ex: from tickleapp)
 */
Parse.Cloud.job("twitterParser", function (request, status) {

    Parse.Cloud.useMasterKey();

    var that = this;

    var twitterParser = new Twitter(
        {
            // Parse Table name
            tableName: "user_status",
            mentionsTable: "metioning_history",
            timelineTable: "twitter_user_timeline",

            // screen_name to process
            screenNames: ["tickleapp", "wonderworkshop", "spheroedu", "gotynker", "hopscotch", "codehs", "kodable", "codeorg", "scratch", "trinketapp"],

            // NodeJs env setting, may be set in heroku dashboard
            consumerSecret     : process.env.COMSUMER_SECRET,
            oauth_consumer_key : process.env.OAUTH_CONSUMER_KEY,
            tokenSecret        : process.env.TOKEN_SECRET,
            oauth_token        : process.env.OAUTH_TOKEN,

            tweetsPerPage: 200,
            tweetsPerSearchPage: 100,
            maxQueryTweets: 3200
        }
    );

    twitterParser.status = status;

    // Parsing Procedure
    Parse.Promise.when(

        twitterParser.performScreenNamesLookup()

    ).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished performScreenNamesLookup.");

            return Parse.Promise.when(twitterParser.performUserTweetsAnalytics());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished performUserTweetsAnalytics.");

            return Parse.Promise.when(twitterParser.calculateHistoricalMetrics());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished calculateHistoricalMetrics.");

            return Parse.Promise.when(twitterParser.performMentioningSearch("forward"));

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished performMentioningSearch.");

            return Parse.Promise.when(twitterParser.savingMentionsOnParse());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished savingMentionsOnParse.");

            return Parse.Promise.when(twitterParser.calculatingMentioning());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished calculatingMentioning.");

            return Parse.Promise.when(twitterParser.savingUserTimelineStatus());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished savingUserTimelineStatus.");

            return Parse.Promise.when(twitterParser.updateTweetsObjectId());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished updateTweetsObjectId.");

            return twitterParser.batchSavingRecords(twitterParser.tweets);

        });

});

/**
 * JOB: testParseSave
 *
 * Unused Job, mainly the boilerplate of our saving method in Parse.com cloud function. Since we have limited request
 * per seconds, controlling save request is crucial.
 *
 * 'setTimeout' function is actually not functioning on Parse.com, however, we host our Cloud Job on heroku with pure Node.js Env.
 *
 */
Parse.Cloud.job("testParseSave", function (request, status) {

    Parse.Cloud.useMasterKey();

    var i, pages, promise;
    var testPrototype = Parse.Object.extend("test");
    var perBatch = 20;
    var data = [];

    for (i = 0; i < 3000 ; i++ )
    {
        var test = new testPrototype();
        test.set("ts", (new Date).getTime());
        data.push(test);
    }

    // Calculation of total pages
    pages = Math.floor(data.length / perBatch);
    pages = (data.length % perBatch) > 0 ? pages + 1 : pages;
    promise = Parse.Promise.as({"index": 0, "ts": (new Date).getTime()});

    for (i = 0; i < pages ; i++)
    {
        promise = promise.then(function(k)
        {
            var spliceAmount = data.length > perBatch ? perBatch : data.length;
            var dataToSave = data.splice(0, spliceAmount);
            var pagePromise = new Parse.Promise();

            Parse.Object.saveAll(dataToSave).then(
                function(objs)
                {
                    var ts = (new Date).getTime();
                    var diff = ts - k.ts;
                    var threshold = 1000;

                    console.log("Diff:" + diff, k.index);

                    if (diff < threshold)
                    {
                        var toSleep = threshold - diff;

                        console.log(toSleep);

                        try
                        {
                            setTimeout(function(){

                                console.log("Saved Page. " + k.index);

                                pagePromise.resolve({"index": k.index+1, "ts": (new Date).getTime()});

                            }, toSleep);
                        }
                        catch (e) {
                            console.log(JSON.stringify(e));
                        }

                    }
                    else {
                        pagePromise.resolve({"index": k.index+1, "ts": (new Date).getTime()});
                    }

                },
                function(e)
                {
                    console.log(JSON.stringify(e));

                    return promise.reject("Save error");
                }
            );

            return pagePromise;
        });
    }

    Parse.Promise.when(promise).then(
        function()
        {
            console.log("Batch Save success.");
        },
        function(e)
        {
            console.log(JSON.stringify(e));
        }
    );

});