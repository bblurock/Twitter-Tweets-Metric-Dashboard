var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var ParseCloud = require('parse-cloud-express');
var Parse = ParseCloud.Parse;

Parse.initialize('C7HX2LIkyy7gVxQWWfNMg6rWLYm03wPa9kIdI3T8', 'JOltyNQUQm0on6E04QrY2XICKogArMdE5eemQh0h', 'zLCPWgxcnuNR4T10ZLeM8YBbzN6RxAwtUxgt7rcc');

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

for (var j= 0; j < pages ; j++)
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