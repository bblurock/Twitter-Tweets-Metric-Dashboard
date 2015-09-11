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
		getTweets: ['tickleapp'],
	};

	var jobs = {
		getTweets: function(screenName){

			var promise = new Parse.Promise();

			var Tweets = Parse.Object.extend("Tweets");

			var query = new Parse.Query(Tweets);

			query.equalTo("screen_name", screenName);

			query.descending("id_str")

			query.limit(1);

			query.find().then(function(results){

				if(results.length === 0){
					// If this is the first time this script has run, then we need don't
					// need to have the since_id param

					var urlLink = "https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=" + screenName + "&exclude_replies=true&include_rts=true&count=100";

				} else {

					var lastTweetId = results[0].get("id_str");

					var urlLink = "https://api.twitter.com/1.1/statuses/user_timeline.json?screen_name=" + screenName + "&exclude_replies=true&include_rts=true&since_id=" + lastTweetId;

				};

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
					   Authorization: 'OAuth oauth_consumer_key="'+oauth_consumer_key+'", oauth_nonce=' + nonce + ', oauth_signature=' + encodedSig + ', oauth_signature_method="HMAC-SHA1", oauth_timestamp=' + timestamp + ',oauth_token="'+oauth_token+'", oauth_version="1.0"'
					},
					success: function(httpResponse) { 
			 
						var data = JSON.parse(httpResponse.text);

						var tweets = new Array();

						for (var i = 0; i < data.length; i++) {

							var Tweets = Parse.Object.extend("Tweets"),
								tweet = new Tweets(),
								content = data[i];

							tweet.set("text", content.text);
							tweet.set("source", content.source);
							tweet.set("retweet_count", content.retweet_count);
							tweet.set("created_at", content.created_at );
							tweet.set("favorite_count", content.favorite_count);
							tweet.set("retweeted", content.retweeted);
							tweet.set("entities", content.entities);
							tweet.set("id_str", content.id_str);
							tweet.set("screen_name", screenName);
						 
							tweets.push(tweet);

						};

						Parse.Object.saveAll(tweets, {
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
