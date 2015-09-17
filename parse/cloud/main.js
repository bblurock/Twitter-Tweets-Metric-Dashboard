var _ = require('underscore');
var oauth = require("cloud/libs/oauth.js");

Parse.Cloud.job("twitterFeed", function (request, status) {

    Parse.Cloud.useMasterKey();

    var that = this;

    this.tableName = "user_status_dev";
    this.trackingScreenNames = ['bblurock', 'tickleapp', 'wonderworkshop', 'spheroedu', 'gotynker', 'hopscotch', 'codehs', 'kodable', 'codeorg', 'scratch', 'trinketapp'];
    this.trackingParseIDs = [];

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


    /**
     * @param  {array}         screenNames Containing the screen_name of desired Twitter account
     * @return {Parse.Promise}
     */
    function lookupUsersInfo(screenNames) {

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

                        var tweets = new Array();

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
    function calculateTweetsInfoFromUsers() {

        // This promise is for the current method
        var promise = new Parse.Promise();

        _.each(this.trackingParseIDs, function (id) {
            var userStatus = Parse.Object.extend(that.tableName);
            var userQuery = new Parse.Query(userStatus);

            console.log(id);

            userQuery.get(id, {
                success: function (record) {
                    var queryPromises = [];

                    var screen_name = record.get("screen_name");
                    console.log(record);

                    if (record.length === 0) {
                        console.log("-- Get record faild.");

                        promise.reject();
                    }

                    console.log("-- Get record successed." + screen_name);

                    var totalTweets = 0,
                        totalFavorited = 0,
                        totalRetweeted = 0;

                    var pagingCallback = function(record, objectLength, nextMaxId, queryPromise) {

                        if (objectLength == 200) {
                            processApi(nextMaxId - 1);
                        }

                        queryPromise.resolve();

                        Parse.Promise.when(queryPromise).then(function() {
                            record.set("favorited", totalFavorited);
                            record.set("retweeted", totalRetweeted);
                            record.set("total_cacl", totalTweets);

                            console.log((new Date().getTime() / 1000) + " Total length: " + totalTweets);

                            record.save(null, {
                                success: function (objs) {
                                    console.log("-- statuses/user_timeline Saved " + screen_name + "/" + totalTweets + ", successed.");
                                },
                                error: function (error) {
                                    console.log("-- statuses/user_timeline failed.");
                                    console.log(error);
                                }
                            });
                        });

                    };

                    var processApi = function (max_id) {

                        // Initialize max_id
                        max_id = max_id || 0;

                        // Prepare concatenating for max_id query string
                        var max_id_str = (max_id == 0) ? '' : 'max_id=' + max_id;

                        var urlLink = "https://api.twitter.com/1.1/statuses/user_timeline.json?include_rts=false&screen_name=" + screen_name + "&count=200&" + max_id_str;

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

                        // Promise for current api call
                        var queryPromise = new Parse.Promise();

                        queryPromises.push(Parse.Cloud.httpRequest({
                            method: "GET",
                            url: urlLink,
                            headers: {
                                Authorization: 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="' + oauth_token + '", oauth_version="1.0"'
                            },
                            success: function (httpResponse) {
                                var data = JSON.parse(httpResponse.text);

                                console.log((new Date().getTime() / 1000) + " Length: " + data.length);

                                totalTweets += data.length;

                                for (var i = 0; i < data.length; i++) {
                                    totalFavorited += data[i].favorite_count;
                                    totalRetweeted += data[i].retweet_count;
                                }

                                return Parse.Promise.when(pagingCallback(record, data.length, data[data.length - 1].id_str, queryPromise));
                            },
                            error: function (error) {
                                console.log(error);

                                // Reject the whole method
                                promise.reject(error.message);

                                // Reject Current api call
                                queryPromise.reject();
                            }
                        }));

                        // Every api call, we add to collection, and wait for every call to finished
                    };

                    /**
                     * Perform Twitter Api call: statuses/user_timeline
                     *
                     * Each api call may only conatain 200 maximum tweets,
                     * hence, callback funcion is perform to deal with asychronous api calls
                     */
                    processApi();

                    Parse.Promise.when(queryPromises).then(function () {

                    });
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

        return promise;

    };

    Parse.Promise.when(lookupUsersInfo(this.trackingScreenNames))
        .then(function () {
            calculateTweetsInfoFromUsers()
        });

});
