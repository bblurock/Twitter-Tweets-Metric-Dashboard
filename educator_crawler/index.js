"use strict";

var phantomAPI = require("phantom"),
	phantomjs  = require("phantomjs"),
	color      = require("colors"),
	Crawler    = require("simplecrawler"),
	stringify  = require("csv-stringify"),
	generate   = require("csv-generate"),
	fs         = require("fs"),
	gmap       = require("googlemaps");


var stdin = process.stdin;

var columns = {
	firstName: "firstName",
	lastName: "lastName",
	email: "email",
	eventName: "eventName",
	organiztion: "organiztion",
	location: "location",
	address: "address",
	cCode: "countryCode"
};

var phantomBin = phantomjs.path,
	phantomQueue = [],
	phantomBannedExtensions = /\.(png|jpg|jpeg|gif|ico|css|js|csv|doc|docx|pdf)$/i,
	euroCodeCrawler = new Crawler("events.codeweek.eu", "/search"),
	stringifier = stringify({header: true, columns: columns}),
	generator = generate(),
	output = [],
	queueBeingProcessed = false;

phantomAPI.create({ binary: phantomBin, that: this }, runCrawler);

stringifier.on('readable', function(){
	var row;

	while(row = stringifier.read()){
		output += row;
	}
});

euroCodeCrawler.on("complete", function()
{
	stringifier.end();

	var promise = new Promise(function(resolve, reject){
		saveFile(resolve);
	});

	promise.then(function()
	{
		process.exit();
	});
});


// without this, we would only get streams once enter is pressed
stdin.setRawMode( true );

// resume stdin in the parent process (node app won't quit all by itself
// unless an error or process.exit() happens)
stdin.resume();

// i don't want binary, do you?
stdin.setEncoding( 'utf8' );

// on any data into stdin
stdin.on('data', function( key ){
	// ctrl-c ( end of text )
	if ( key === '\u0003' ) {
		console.log("Caught interrupt signal");

		stringifier.end();

		var promise = new Promise(function(resolve, reject){
			saveFile(resolve);
		});

		promise.then(function()
		{
			process.exit();
		});

	}
	// write the key to stdout all normal like
	process.stdout.write( key );
});

function runCrawler(phantom) {

	euroCodeCrawler.start();

	euroCodeCrawler.on("queueadd", function(queueItem) {

		var regex = new RegExp('\/view\/[0-9]+\/', 'g');

		if (queueItem.path.search(regex) != -1) {
			var resume = this.wait();

			phantomQueue.push(queueItem.url);
			processQueue(phantom, resume);
		}

	});
}

function makePage(phantom, url, callback) {
	phantom.createPage(function(page) {
		page.open(url, function(status) {
			page.includeJs("https://code.jquery.com/jquery-2.1.4.min.js", callback(page, status));
		});
	});
}

function getLinks(phantom, url, callback)
{
	console.log("Phantom attempting to load %s ", url);

	if (!url.match(phantomBannedExtensions)) {
		makePage(phantom, url, function(page, status) {
			console.log("Phantom opened URL with %s — %s ", status, url);

			page.evaluate(findEducatorInfo, function(result) {
				console.log(JSON.stringify(result).green);

				var promise = new Promise(function(resolve, reject)
				{
					var gmAPI = new gmap({
						google_private_key: 'AIzaSyA_APcjS6OLbe-oQhruqBncUFT6pHPir-E',
						secure: true // use https
					});

					gmAPI.geocode({"address": result.address}, function(err, mapResult){
						var code = "";

						if (mapResult)
						{
							mapResult.results[0].address_components.map(function(item)
							{
								if (item.types.indexOf('country') >= 0)
								{
									code = item.short_name;
								}
							});
						}

						resolve(code);
					});
				});

				promise.then(function(code)
				{
					stringifier.write([
						"",                  // First Name
						"",                  // Last Name
						result.email,        // email
						result.event,        // Event Name
						result.organization, // Organiztion
						"",                  // Location
						result.address,      // address
						code                 // country code
					]);

					callback(page);
				});
			});
		});
	}
	else {
		callback();
	}
}

function findEducatorInfo() {
	// first name, last name, email, event name, organization, location, address, country code

	var event = {
		event: "",
		email: "",
		organization: "",
		location: "",
		address: "",
		country_code: ""
	};

	var $desc = $(".event-description");

	event.event = $desc.find("h1").text();
	event.organization = $desc.find("h1").next().next().text();
	event.email = $desc.find("a[href^='mailto:']").first().text();
	event.address = $desc.find("address").text().replace(/\\n\\t\\t\\t\\t\\t/g, "").replace("Happening at:", "").trim();

	return event;
}

function processQueue(phantom, resume) {
	if (queueBeingProcessed) {
		return;
	}
	queueBeingProcessed = true;

	(function processor(item) {
		if (!item) {
			console.log("Phantom reached end of queue! ------------");

			queueBeingProcessed = false;

			return resume();
		}

		getLinks(phantom, item, function(page) {
			// Break up stack so we don't blow it
			if (page) {
				page.close();
			}

			setTimeout(processor.bind(null, phantomQueue.shift()), 10);
		});

	})(phantomQueue.shift());
}

function saveFile(resolve) {
	var date = new Date(),
		dateStr = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

	console.log(output);

	fs.writeFile("./output/euro-code-week" + dateStr + ".csv", output, function(err) {

		if(err) {
			return console.log(err);
		}

		resolve();

		console.log("The file was saved!");
	});
}