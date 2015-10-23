var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var ParseCloud = require('parse-cloud-express');
var Parse = ParseCloud.Parse;

Parse.initialize('C7HX2LIkyy7gVxQWWfNMg6rWLYm03wPa9kIdI3T8', 'JOltyNQUQm0on6E04QrY2XICKogArMdE5eemQh0h', 'zLCPWgxcnuNR4T10ZLeM8YBbzN6RxAwtUxgt7rcc');

Parse.Cloud.useMasterKey();

var pages, promise;
var testPrototype = Parse.Object.extend("test");

promise = Parse.Promise.as(0);

for(var i = 0; i < 29 ; i++)
{

	promise = promise.then(function(k)
	{
		var batchLocal = [];

		for(var j = 0; j < 100 ; j++)
		{
			var test = new testPrototype();

			test.set("ts", (new Date).getTime());

			batchLocal.push(test);
		}

		console.log("Batch Size: " + batchLocal.length);

		return Parse.Object.saveAll(batchLocal).then(
			function(objs)
			{
				console.log("Saved Page. " + k);

				//sleep.sleep(1);

				return Parse.Promise.as(k+1);
			},
			function(e)
			{
				console.log(JSON.stringify(e));

				return promise.reject("Save error");
			}
		);

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