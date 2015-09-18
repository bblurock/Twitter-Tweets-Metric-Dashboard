var _ = require('underscore');
var oauth = require("cloud/libs/oauth.js");
//var oauth = require("./libs/oauth.js");

Parse.Cloud.job("twitterFeed", function (request, response) {
//Parse.Cloud.define('hello', function(request, response) {
    Parse.Cloud.useMasterKey();

    var that = this;

    this.tableName = "user_status";
    this.trackingScreenNames = ['tickleapp', 'wonderworkshop', 'spheroedu', 'gotynker', 'hopscotch', 'codehs', 'kodable', 'codeorg', 'scratch', 'trinketapp'];
    this.trackingParseIDs = [];
    this.countsPerBatch = 100;

    // Read parameters from Parse.com
    var consumerSecret = request.params.consumerSecret;
    var oauth_consumer_key = request.params.oauth_consumer_key;
    var tokenSecret = request.params.tokenSecret;
    var oauth_token = request.params.oauth_token;

    // Setup shared vars for Twitter API
    var nonce = oauth.nonce(32);
    var ts = Math.floor(new Date().getTime() / 1000);
    var timestamp = ts.toString();

    var accessor = {
        consumerSecret: consumerSecret,
        tokenSecret: tokenSecret
    };

    var params = {
        oauth_version: "1.0",
        oauth_consumer_key: oauth_consumer_key,
        oauth_token: oauth_token,
        oauth_timestamp: timestamp,
        oauth_nonce: nonce,
        oauth_signature_method: "HMAC-SHA1"
    };

    var idStrDecrement = function(idStr){
        var index = 1,
            flag = true,
            length = idStr.length;

        function setCharAt(str, index, chr) {
            if (index > str.length - 1) {
                return str;
            }

            return str.substr(0, index) + chr + str.substr(index + 1);
        }

        while (flag) {
            var i = length - index,
                currentDigit = idStr[i];

            currentDigit = parseInt(currentDigit) - 1;

            if (currentDigit >= 0) {
                flag = false;
                idStr = setCharAt(idStr, i, currentDigit.toString());

                continue;
            }

            idStr = setCharAt(idStr, i, "0");
            index++;
        }

        return idStr;
    };

    /**
     * @param  {array}         screenNames Containing the screen_name of desired Twitter account
     * @return {Parse.Promise}
     */
    var lookupUsersInfo = function (screenNames) {

        // This promise is for the current method
        var promise = new Parse.Promise();

        var users = [],
            lookupUsers = [],
            queryPromises = [];

        // Filter out the screenNames' that already been processed
        _.each(screenNames, function (screenName) {
            var queryPromise = new Parse.Promise();

            // set today starting at 00:00:00
            var today = new Date();
            var userStatus = Parse.Object.extend(that.tableName);
            var query = new Parse.Query(userStatus);

            today.setHours(0, 0, 0, 0);
            query.descending("createdAt");
            query.equalTo("screen_name", screenName.toLowerCase());
            query.greaterThanOrEqualTo("createdAt", today);
            query.limit(1);

            query.find().then(function (result) {

                // The user job already been done today.
                if (result.length === 0) {
                    users.push(screenName);
                }

                queryPromise.resolve();
            });

            queryPromises.push(queryPromise);
        });

        // Perform Twitter Api call: users/lookup
        Parse.Promise.when(queryPromises).then(function () {

            var usersStr = users.join();

            if (usersStr === "") {
                console.log("-- users/lookup.json: nothing new.");

                promise.resolve();
            }
            else {
                var urlLink = "https://api.twitter.com/1.1/users/lookup.json?screen_name=" + usersStr;

                var message = {
                    method: "GET",
                    action: urlLink,
                    parameters: params
                };

                oauth.SignatureMethod.sign(message, accessor);

                //var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
                //var baseString = oauth.SignatureMethod.getBaseString(message);
                var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
                var encodedSig = oauth.percentEncode(sig);

                Parse.Cloud.httpRequest({
                    method: "GET",
                    url: urlLink,
                    headers: {
                        Authorization: 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="' + oauth_token + '", oauth_version="1.0"'
                    },
                    success: function (httpResponse) {
                        var data = JSON.parse(httpResponse.text);

                        var lookupUsers = new Array();

                        for (var i = 0; i < data.length; i++) {
                            var usersClass = Parse.Object.extend(that.tableName),
                                user = new usersClass();

                            user.set("user_id", data[i].id);
                            user.set("screen_name", data[i].screen_name.toLowerCase());
                            user.set("following", data[i].friends_count);
                            user.set("followers", data[i].followers_count);
                            user.set("favorites", data[i].favourites_count);
                            user.set("listed", data[i].listed_count);

                            lookupUsers.push(user);
                        }

                        Parse.Object.saveAll(lookupUsers, {
                            success: function (objs) {
                                console.log("-- users/json.php Lookup successed.");

                                // Track the success Ids for next API procedure
                                _.each(objs, function (obj) {
                                    that.trackingParseIDs.push(obj.id);
                                });

                                promise.resolve();
                            },
                            error: function (error) {
                                // status.error("-- users/json.php Lookup failed.");
                                console.log("-- users/json.php Lookup failed.");
                                console.log(error);

                                promise.reject(error.message);
                            }
                        });
                    },
                    error: function (error) {
                        console.log(error);

                        promise.reject(error.message);
                    }
                });
            }

        });

        return Parse.Promise.when(promise);
    }

    /**
     * @return {Parse.Promise}
     */
    var calculateTweetsInfoFromUsers = function () {

        // This promise is for the current method
        var promise = new Parse.Promise();

        var promisesCollection = [];

        _.each(this.trackingParseIDs, function (id) {

            var loopingPromise = new Parse.Promise();
            promisesCollection.push(loopingPromise);

            var userStatus = Parse.Object.extend(that.tableName);
            var userQuery = new Parse.Query(userStatus);

            userQuery.get(id, {
                success: function (record) {

                    var screen_name = record.get("screen_name");

                    console.log("\n\n" + (new Date().getTime() / 1000) + " screen_name: " + screen_name);

                    if (record.length === 0) {
                        console.log("-- Get record faild.");

                        promise.reject();
                    }

                    var totalTweets = 0,
                        totalFavorited = 0,
                        totalRetweeted = 0,
                        originalTweets = 0;

                    var pagingCallback = function (record, objectLength, nextMaxId) {

                        record.set("favorited", totalFavorited);
                        record.set("retweeted", totalRetweeted);
                        record.set("replies", totalTweets - originalTweets);
                        record.set("tweets", originalTweets);

                        //console.log((new Date().getTime() / 1000) + " Total length: " + totalTweets);

                        return record.save(null, {
                            success: function (objs) {

                                //console.log("-- statuses/user_timeline Saved " + screen_name + "/" + totalTweets + ", successed.");

                                if (objectLength == that.countsPerBatch) {
                                    return processApi(nextMaxId);
                                }
                                else {
                                    // Only when there's no paginations left, we then mark looping resolve();
                                    loopingPromise.resolve();

                                    return Parse.Promise.as();
                                }
                            },
                            error: function (error) {
                                console.log("-- statuses/user_timeline failed.");
                                console.log(error);
                            }
                        });

                    };

                    var processApi = function (max_id) {

                        // Initialize max_id
                        max_id = max_id || 0;

                        // Prepare concatenating for max_id query string
                        var max_id_str = (max_id == 0) ? '' : 'max_id=' + max_id;

                        //var urlLink = "https://api.twitter.com/1.1/statuses/user_timeline.json?include_rts=false&screen_name=" + screen_name + "&count=200&" + max_id_str;
                        var urlLink = "https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=" + screen_name + "&count=" + that.countsPerBatch + "&" + max_id_str;

                        var message = {
                            method: "GET",
                            action: urlLink,
                            parameters: params
                        };

                        oauth.SignatureMethod.sign(message, accessor);

                        //var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
                        //var baseString = oauth.SignatureMethod.getBaseString(message);
                        var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
                        var encodedSig = oauth.percentEncode(sig);

                        return Parse.Cloud.httpRequest({
                            method: "GET",
                            url: urlLink,
                            headers: {
                                Authorization: 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="' + oauth_token + '", oauth_version="1.0"'
                            },
                            success: function (httpResponse) {

                                var datas = JSON.parse(httpResponse.text),
                                    tweetsPromisesCollection = [],
                                    tweets = [];

                                totalTweets += datas.length;

                                _.each(datas, function (data) {

                                    var Tweets = Parse.Object.extend("Tweets"),
                                        tweetPromise = new Parse.Promise(),
                                        tweet = new Tweets(),
                                        tweetQuery = new Parse.Query(Tweets);

                                    tweetsPromisesCollection.push(tweetPromise);

                                    tweetQuery.equalTo("id_str", data.id_str);
                                    tweetQuery.limit(1);

                                    tweetQuery.find().then(function (result) {

                                        if (result.length === 0) {

                                            // Excluding retweets
                                            if (data.text.indexOf("RT @") == -1) {
                                                totalFavorited += data.favorite_count;
                                                totalRetweeted += data.retweet_count;
                                                originalTweets += 1;
                                            }

                                            tweet.set("text", data.text);
                                            tweet.set("source", data.source);
                                            tweet.set("retweet_count", data.retweet_count);
                                            tweet.set("created_at", data.created_at);
                                            tweet.set("favorite_count", data.favorite_count);
                                            tweet.set("retweeted", data.retweeted);
                                            tweet.set("id_str", data.id_str);
                                            tweet.set("screen_name", screen_name);
                                            tweet.set("entities", data.entities);

                                            tweets.push(tweet);
                                        }

                                        tweetPromise.resolve();
                                    });

                                });

                                Parse.Promise.when(tweetsPromisesCollection).then(function(){

                                    Parse.Object.saveAll(tweets, {
                                        success: function(objs) {
                                            console.log("\n\n" + (new Date().getTime() / 1000) + " Saved " + objs.length + " tweets.");
                                        },
                                        error: function(error) {
                                            console.log("Saving Tweets Failed!");
                                        }
                                    })

                                });

                                return pagingCallback(record, datas.length, idStrDecrement(datas[datas.length - 1].id_str));
                            },
                            error: function (error) {
                                console.log(error);

                                // Reject the whole method
                                promise.reject(error.message);
                            }
                        });

                    };

                    /**
                     * Perform Twitter Api call: statuses/user_timeline
                     *
                     * Each api call may only conatain 200 maximum tweets,
                     * hence, callback funcion is perform to deal with asychronous api calls
                     */

                    return Parse.Promise.when(processApi(null));
                },
                error: function (error) {
                    console.log("Uh oh, we couldn't find the object!");

                    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
                        console.log("Uh oh, we couldn't find the object!");
                    } else if (error.code === Parse.Error.CONNECTION_FAILED) {
                        console.log("Uh oh, we couldn't even connect to the Parse Cloud!");
                    }
                }
            });
        });

        Parse.Promise.when(promisesCollection).then(function () {
            console.log("\n\n" + (new Date().getTime() / 1000) + " promises length: " + promisesCollection.length + "\n\n");

            // If all tweets have been save. Then this method is done.
            promise.resolve();
        });

        return promise;

    };

    // Main procedure.
    Parse.Promise.when(lookupUsersInfo(this.trackingScreenNames))
        .then(function () {
            console.log("\n\n" + (new Date().getTime() / 1000) + " Finished Lookup, now processing 'Retweets and Favorited'. \n\n");

            return Parse.Promise.when(calculateTweetsInfoFromUsers());
        }).then(function () {
            console.log("\n\n" + (new Date().getTime() / 1000) + " Finished timeline calculation for Retweets and Favorited, now processing 'Searching'. \n\n");
        });

});