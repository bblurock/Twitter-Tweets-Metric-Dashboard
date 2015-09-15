var _ = require('underscore');
var oauth = require("cloud/libs/oauth.js");

Parse.Cloud.job("twitterFeed", function(request, status) {

    Parse.Cloud.useMasterKey();

    var consumerSecret = request.params.consumerSecret;
    var oauth_consumer_key = request.params.oauth_consumer_key;
    var tokenSecret = request.params.tokenSecret;
    var oauth_token = request.params.oauth_token;

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


    var promises = [];

    var jobsParams = {
        getUserInfo: [['tickleapp', 'wonderworkshop', 'spheroedu', 'gotynker', 'hopscotch', 'codehs', 'kodable', 'codeorg', 'scratch', 'trinketapp']],
        getTweets: ['tickleapp'],
    }; 

    var jobs = {
        getUserInfo: function(screenNames){
            var tableName = "user_status_dev";

            // This promise is for the current method
            var promise = new Parse.Promise();

            var users = new Array();

            var lookupUsers = new Array();

            var queryPromises = new Array();

            // Filter out the screenNames' that already been processed
            _.each(screenNames, function(screenName){

                // This promise is for the current method
                var queryPromise = new Parse.Promise();

                // set today starting at 00:00:00 
                var today = new Date();
                var userStatus = Parse.Object.extend(tableName);
                var query = new Parse.Query(userStatus);

                today.setHours(0,0,0,0);
                query.descending("createdAt");
                query.equalTo("screen_name", screenName.toLowerCase());
                query.greaterThanOrEqualTo("createdAt", today);
                query.limit(1);

                query.find().then(function(result){
                    
                    // Job already done today.
                    if (result.length === 0) {
                        users.push(screenName);
                    }

                    queryPromise.resolve();
                });

                queryPromises.push(queryPromise);
            });

            // Perform Twitter Api call: user/lookup.json
            Parse.Promise.when(queryPromises).then(function(){

                var urlLink = "https://api.twitter.com/1.1/users/lookup.json?screen_name=" + users.join();

                var message = {
                    method: "GET",
                    action: urlLink,
                    parameters: params
                };

                oauth.SignatureMethod.sign(message, accessor);

                var normPar = oauth.SignatureMethod.normalizeParameters(message.parameters);
                var baseString = oauth.SignatureMethod.getBaseString(message);
                var sig = oauth.getParameter(message.parameters, "oauth_signature") + "=";
                var encodedSig = oauth.percentEncode(sig);

                Parse.Cloud.httpRequest({
                    method: "GET",
                    url: urlLink,
                    headers: {
                       Authorization: 'OAuth oauth_consumer_key="' + oauth_consumer_key + '", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="'+oauth_token+'", oauth_version="1.0"'
                    },
                    success: function(httpResponse) {
                        var data = JSON.parse(httpResponse.text);

                        var tweets = new Array();

                        for (var i = 0; i < data.length; i++) {
                            var usersClass = Parse.Object.extend(tableName),
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
                            success: function(objs) {
                                promise.resolve();
                            },
                            error: function(error) {
                                console.log(error);
                                promise.reject(error.message);
                            }
                        });
                    },
                    error: function(error) {
                        console.log(error);
                        promise.reject(error.message);
                    }
                });

            });
            
            return promise;
        },
    };

    for(key in jobs){

        promises.push(jobs[key].apply(null, jobsParams[key]));

    };

    Parse.Promise.when(promises).then(function(){

        status.success("Tweets saved");

    }, function(error){

        status.error("Tweets failed to update");

    });

});
