var _ = require('underscore');
var oauth = require("cloud/libs/oauth.js");

Parse.Cloud.job("test1000", function (request, status) {

    Parse.Cloud.useMasterKey();

    var i, tests = [];

    for (i = 0; i < 3000 ; i++)
    {
        var testingPrototype = Parse.Object.extend("testing");

        var test = new testingPrototype();

        test.set("timestamp", (new Date().getTime()/1000).toString());

        tests.push(test);

        console.log(i);
    }

    console.log("Start saving.");

    Parse.Object.saveAll(tests, {
        success: function(objs) {
            console.log('Saving success ' + objs.length);
        },
        error: function(e) {

        }
    });
});


Parse.Cloud.job("test3000", function (request, status) {

    Parse.Cloud.useMasterKey();

    var i, tests = [];

    for (i = 0; i < 3000 ; i++)
    {
        var testingPrototype = Parse.Object.extend("testing");

        var test = new testingPrototype();

        test.set("timestamp", (new Date().getTime()/1000).toString());

        tests.push(test);

        console.log(i);
    }

    console.log("Start saving.");

    Parse.Object.saveAll(tests, {
        success: function(objs) {
            console.log('Saving success ' + objs.length);
        },
        error: function(e) {

        }
    });
});

Parse.Cloud.job("twitterParser", function (request, status) {

    Parse.Cloud.useMasterKey();

    var Twitter = function(params) {

        this.tableName = params.tableName;

        this.screenNames = params.screenNames;

        this.tweetsPerPage = params.tweetsPerPage;

        this.tweetsPerSearchPage = params.tweetsPerSearchPage;

        this.maxQueryTweets = params.maxQueryTweets;

        // Setup twitter app keys for Twitter API
        this.consumerSecret     = params.consumerSecret;
        this.oauth_consumer_key = params.oauth_consumer_key;
        this.tokenSecret        = params.tokenSecret;
        this.oauth_token        = params.oauth_token;

        this.ts = new Date().getTime() / 1000;
        this.timestamp = Math.floor(this.ts).toString();

        this.twitterAccessor = {
            consumerSecret: this.consumerSecret,
            tokenSecret   : this.tokenSecret
        };

        this.counters = {
            totalTweets    : 0,
            totalFavorited : 0,
            totalRetweeted : 0,
            originalTweets : 0,
            totalReplies   : 0,
            totalRetweets  : 0,
            totalReplied   : 0,
            totalMetioned  : 0,
            totalShared    : 0
        };

        this.data = [];

    };

    Twitter.prototype = {

        initializeApi: function(url) {

            var urlLink = url;

            // Setup shared vars for Twitter API
            var nonce     = oauth.nonce(32);

            var twitterParams = {
                oauth_version         : "1.0",
                oauth_consumer_key    : this.oauth_consumer_key,
                oauth_token           : this.oauth_token,
                oauth_timestamp       : this.timestamp,
                oauth_nonce           : nonce,
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

        queryUserTimelineApiCallback: function (recordLength, nextMaxId, screenName, promise) {

            console.log(this.data[screenName].totalTweets);

            if (this.counters.totalTweets <= this.maxQueryTweets && recordLength > 0) {

                //console.log("RecordLength: " + recordLength);

                return this.queryUserTimelineApi(nextMaxId, screenName, promise);
            }
            else {

                //console.log("RecordLength: " + recordLength);

                // When there's no further page left
                this.data[screenName].favorited   = this.counters.totalFavorited;
                this.data[screenName].retweeted   = this.counters.totalRetweeted;
                this.data[screenName].replies     = this.counters.totalReplies;
                this.data[screenName].tweets      = this.counters.originalTweets - this.counters.totalReplies;
                this.data[screenName].retweets    = this.counters.totalRetweets;
                this.data[screenName].totalTweets = this.counters.totalTweets;

                //console.log((new Date().getTime() / 1000) + " " + JSON.stringify(this.data[screenName]));

                promise.resolve("Finishing Pagination!");
            }
        },

        queryUserTimelineApi: function (maxId, screenName, promise) {

            var that = this;

            var promise = promise || new Parse.Promise();

            // Initialize max_id
            maxId = maxId || 0;

            // Prepare concatenating for max_id query string
            var maxIdStr = (maxId === 0) ? '' : '&max_id=' + maxId;

            var url = "https://api.twitter.com/1.1/statuses/user_timeline.json?include_rts=1&screen_name=" + screenName + "&count=" + that.tweetsPerPage + maxIdStr;

            var apiAuthorizationHeaders = that.initializeApi(url);

            //console.log((new Date().getTime() / 1000) + " : " + url);

            Parse.Cloud.httpRequest({
                method: "GET",
                url: url,
                headers: {
                    Authorization: apiAuthorizationHeaders
                },
                success: function (httpResponse) {

                    var i, nextMaxId = 0;

                    var results = JSON.parse(httpResponse.text);

                    that.counters.totalTweets += results.length;

                    for (i = 0; i < results.length ; i++) {

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

                    if (results.length !== 0) {
                        nextMaxId = that.getDecrementMaxId(results[results.length - 1].id_str);
                    }

                    return that.queryUserTimelineApiCallback(results.length, nextMaxId, screenName, promise);
                },
                error: function (httpResponse) {
                    console.log("Twitter API error code: " + httpResponse.status);
                }
            }); // httpRequest

            return promise;
        },

        performUserTweetsAnalytics: function() {

            var that = this;

            var promise = Parse.Promise.as();

            _.each(that.screenNames, function(screenName) {

                promise = promise.then(function () {

                    // Reset all counters
                    for (var key in that.counters)
                    {
                        that.counters[key] = 0;
                    }

                    console.log((new Date().getTime() / 1000) + " ScreenName: " + screenName);

                    return that.queryUserTimelineApi(null, screenName).then(function () {
                        return Parse.Promise.as();
                    });

                }); // promise

            }); // _.each

            return promise;

        },

        querySearchApiCallback: function (recordLength, nextMaxId, screenName, promise) {

            if (this.data[screenName].totalTweets <= this.maxQueryTweets && recordLength > 0) {

                //console.log("RecordLength: " + recordLength);

                return this.querySearchApi(nextMaxId, screenName, promise);
            }
            else {

                console.log("RecordLength: " + recordLength);

                // When there's no further page left

                promise.resolve("Finishing Pagination!");
            }
        },

        querySearchApi: function (maxId, screenName, promise) {

            var that = this;

            var promise = promise || new Parse.Promise();

            // Initialize max_id
            maxId = maxId || 0;

            // Prepare concatenating for max_id query string
            var maxIdStr = (maxId === 0) ? '' : '&max_id=' + maxId;

            var url = "https://api.twitter.com/1.1/search/tweets.json?q=" + encodeURIComponent("@") + screenName + "&count=" + that.tweetsPerSearchPage + maxIdStr + "&result_type=recent&include_entities=true";

            //console.log(url);

            var apiAuthorizationHeaders = that.initializeApi(url);

            Parse.Cloud.httpRequest({
                method: "GET",
                url: url,
                headers: {
                    Authorization: apiAuthorizationHeaders
                },
                success: function (httpResponse) {

                    var i, nextMaxId = 0;

                    var results = JSON.parse(httpResponse.text);

                    console.log(JSON.stringify(results));

                    for (i = 0; i < results.length ; i++) {

                        //console.log(results[i].text);

                    }

                    if (results.length !== 0) {
                        nextMaxId = that.getDecrementMaxId(results[results.length - 1].id_str);
                    }

                    return that.querySearchApiCallback(results.length, nextMaxId, screenName, promise);
                },
                error: function (httpResponse) {
                    console.log("Twitter API error code: " + httpResponse.status);
                }
            }); // httpRequest

            return promise;

        },

        performUserInteractionAnalytics: function () {

            var that = this;

            var promise = Parse.Promise.as();

            _.each(that.screenNames, function(screenName) {

                promise = promise.then(function () {

                    return that.querySearchApi(null, screenName).then(function () {
                        return Parse.Promise.as();
                    });

                }); // promise

            }); // _.each

            return promise;

        },

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

        performScreenNamesLookup: function() {

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

                    for (i = 0; i < results.length ; i++) {

                        name = results[i].screen_name.toLowerCase();

                        if (!(name in data))
                        {
                            that.initDataObject(name);
                        }

                        data[name].screen_name = results[i].screen_name.toLowerCase();
                        data[name].following   = results[i].friends_count;
                        data[name].followers   = results[i].followers_count;
                        data[name].favorites   = results[i].favourites_count;
                        data[name].listed      = results[i].listed_count;
                    }

                },
                error: function (httpResponse) {
                    console.log('Request failed with response code ' + JSON.stringify(httpResponse.headers));
                }
            }); // httpRequest
        },

        savingUserTimelineStatus: function () {

            var tweetsPrototype = Parse.Object.extend("user_status");

            var that = this;

            var promise = Parse.Promise.as(0);

            var i;

            for (i = 0 ; i < that.screenNames.length ; i++) {

                promise = promise.then(function (k) {

                    var name = that.screenNames[k];

                    console.log((new Date().getTime() / 1000) + " Saving timeline: " + name);

                    var userTimelinePrototype = Parse.Object.extend("twitter_user_timeline");

                    var user = new userTimelinePrototype();

                    user.set("screen_name", that.data[name].screen_name);
                    user.set("following"  , that.data[name].following   ? that.data[name].following   : 0 );
                    user.set("followers"  , that.data[name].followers   ? that.data[name].followers   : 0 );
                    user.set("favorites"  , that.data[name].favorites   ? that.data[name].favorites   : 0 );
                    user.set("favorited"  , that.data[name].favorited   ? that.data[name].favorited   : 0 );
                    user.set("listed"     , that.data[name].listed      ? that.data[name].listed      : 0 );
                    user.set("tweets"     , that.data[name].tweets      ? that.data[name].tweets      : 0 );
                    user.set("replies"    , that.data[name].replies     ? that.data[name].replies     : 0 );
                    user.set("retweets"   , that.data[name].retweets    ? that.data[name].retweets    : 0 );
                    user.set("retweeted"  , that.data[name].retweeted   ? that.data[name].retweeted   : 0 );
                    user.set("totalTweets", that.data[name].totalTweets ? that.data[name].totalTweets : 0 );
                    user.set("metioned"   , that.data[name].metioned    ? that.data[name].metioned    : 0 );
                    user.set("replied"    , that.data[name].replied     ? that.data[name].replied     : 0 );
                    user.set("shared"     , that.data[name].shared      ? that.data[name].shared      : 0 );

                    return user.save().then(function(objs) {

                        console.log((new Date().getTime() / 1000) + " Saved " + name + " timeline.");

                        return Parse.Promise.as(k+1);

                    }, function(e) {

                        console.error(e);

                    });

                });
            }

            return promise;
        },

        assignExistedTweetObjectId: function(name) {

            var i, j;
            var tweetsPrototype = Parse.Object.extend("Tweets");
            var query = new Parse.Query(tweetsPrototype);
            var that = this;

            query.select("objectId", "id_str", "screen_name");

            query.equalTo("screen_name", name);

            return query.find().then(function (results) {

                if (results.length === 0) {
                    return Parse.Promise.as();
                }

                for (i = 0 ; i < results.length ; i++ )
                {
                    for (j = 0 ; j < that.length ; j++ )
                    {
                        if (results[i].get("id_str") === that[j].id_str)
                        {
                            that[j].objectId = results[i].id;
                        }
                    }
                }

                return Parse.Promise.as();
            });

        },

        savingTweetsOnParse: function() {

            var tweetsPrototype = Parse.Object.extend("Tweets");
            var that = this;
            var promise = Parse.Promise.as(0);
            var n;

            for (n = 0 ; n < that.screenNames.length ; n++) {

                promise = promise.then(function (nameIndex) {

                    var name = that.screenNames[nameIndex];
                    var length = that.data[name].tweetsDetails.length;

                    console.log((new Date().getTime() / 1000) + " Prepare saving " + length + " tweets of - " + name );

                    var i,
                        beforeSaveTs = new Date().getTime() / 1000,
                        tweets = [],
                        assignIdPromise;

                    assignIdPromise = that.assignExistedTweetObjectId.call(that.data[name].tweetsDetails, name).then(function () {

                        for (i = 0 ; i < length ; i++) {

                            // Collects tweets to push
                            var item = new tweetsPrototype();

                            item.id = that.data[name].tweetsDetails[i].objectId;

                            item.set("text"          , that.data[name].tweetsDetails[i].text);
                            item.set("source"        , that.data[name].tweetsDetails[i].source);
                            item.set("retweet_count" , that.data[name].tweetsDetails[i].retweet_count);
                            item.set("created_at"    , that.data[name].tweetsDetails[i].created_at);
                            item.set("favorite_count", that.data[name].tweetsDetails[i].favorite_count);
                            item.set("retweeted"     , that.data[name].tweetsDetails[i].retweeted);
                            item.set("id_str"        , that.data[name].tweetsDetails[i].id_str);
                            item.set("entities"      , that.data[name].tweetsDetails[i].entities);
                            item.set("screen_name"   , name);

                            //console.log(that.data[name].tweetsDetails[i].favorite_count, that.data[name].tweetsDetails[i].objectId);
                            //
                            //console.log(item.get("favorite_count"));

                            tweets.push(item);
                        }

                        return Parse.Promise.as();

                    });

                    return Parse.Promise.when(assignIdPromise).then(function() {

                        console.log((new Date().getTime() / 1000) + " In Saving.");

                        // Perform Saving
                        return Parse.Object.saveAll(tweets, {

                            success: function (objs) {

                                console.log((new Date().getTime() / 1000) + " Saved " + objs.length + " tweets of " + name);

                            },
                            error: function(e) {

                                console.log("Saving tweets failed.");

                            }
                        }).then(function (objs) {
                            var logPrototype = Parse.Object.extend("Logs");

                            var log = new logPrototype();

                            log.set("saving", objs.length);
                            log.set("target", name);
                            log.set("time", Math.floor((new Date().getTime() / 1000 - beforeSaveTs)).toString());

                            return log.save().then(function (){

                                return Parse.Promise.as(nameIndex+1);

                            });
                        });

                    });

                }); // promise

            } // for loop

            return promise;

        }

    };

    var twitterParser = new Twitter(
        {
            tableName          : "user_status",
            screenNames        : ["tickleapp", "wonderworkshop", "spheroedu", "gotynker", "hopscotch", "codehs", "kodable", "codeorg", "scratch", "trinketapp"],
            consumerSecret     : request.params.consumerSecret,
            oauth_consumer_key : request.params.oauth_consumer_key,
            tokenSecret        : request.params.tokenSecret,
            oauth_token        : request.params.oauth_token,
            tweetsPerPage      : 200,
            tweetsPerSearchPage: 100,
            maxQueryTweets     : 3200
        }
    );


    // Parsing Procedure
    Parse.Promise.when(

        twitterParser.performScreenNamesLookup()

    ).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished performScreenNamesLookup.");

            return Parse.Promise.when(twitterParser.performUserTweetsAnalytics());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished performUserTweetsAnalytics.");

            return Parse.Promise.when(twitterParser.savingUserTimelineStatus());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished savingUserTimelineStatus.");

            return Parse.Promise.when(twitterParser.savingTweetsOnParse());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished savingTweetsOnParse.");

            //return Parse.Promise.when(twitterParser.performUserInteractionAnalytics());

        }).then(function () {

            console.log((new Date().getTime() / 1000) + " Finished Saving Tweets");

            //for (var key in twitterParser.data)
            //{
            //    console.log((new Date().getTime() / 1000) + " Result: " + JSON.stringify(twitterParser.data[key]));
            //}

            status.success("Job Done!");
        });

});