"use strict";

var phantomAPI = require("phantom"),
	phantomjs  = require("phantomjs"),
	color      = require("colors"),
	Crawler    = require("simplecrawler"),
	stringify  = require("csv-stringify"),
	generate   = require("csv-generate"),
	fs         = require("fs"),
	gmap       = require("googlemaps"),
	argv       = require('yargs').argv;

var stdin = process.stdin;

var columns = {
	firstName: "firstName",
	lastName: "lastName",
	email: "email",
	eventName: "eventName",
	organiztion: "organiztion",
	location: "location",
	address: "address",
	cCode: "countryCode",
	link: "link"
};

var phantomBin = phantomjs.path,
	phantomQueue = [],
	phantomBannedExtensions = /\.(png|jpg|jpeg|gif|ico|css|js|csv|doc|docx|pdf)$/i,
	euroCodeCrawler = new Crawler("events.codeweek.eu", "/search"),
	scratchCrawler = new Crawler("day.scratch.mit.edu"),
	stringifier = stringify({header: true, columns: columns}),
	generator = generate(),
	output = [],
	queueBeingProcessed = false,
	currentFileName = "",
	date = new Date(),
	dateStr = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

if (argv.h) {

	process.stdout.write("Usage: \n" +
		"'node index.js -s' for crawling ScratchDay \n" +
		"'node index.js -e' for crawling EU Code Week\n");

	process.exit();
}

if (argv.e || argv.s) {
	if (argv.e) {
		currentFileName = "./output/euro-code-week";
		phantomAPI.create({ binary: phantomBin, that: this }, runEuroCrawler);
	}

	if (argv.s) {
		currentFileName = "./output/scratch-day";
		phantomAPI.create({ binary: phantomBin, that: this }, runScratchCrawler);
	}
}
else {
	process.stdout.write("Usage: \n" +
		"'node index.js -s' for crawling ScratchDay \n" +
		"'node index.js -e' for crawling EU Code Week\n");

	process.exit();
}

stringifier.on('readable', function(){
	var row;

	while(row = stringifier.read()){
		output += row;

		var promise = new Promise(function(resolve, reject){
			saveFile(resolve);
		});

		promise.then(function()
		{
			output = [];
		});
	}
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
			saveFile(resolve, currentFileName);
		});

		promise.then(function()
		{
			process.exit();
		});

	}
	// write the key to stdout all normal like
	process.stdout.write( key );
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

scratchCrawler.on("complete", function()
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

function runScratchCrawler(phantom) {
	var baseUrl = "http://day.scratch.mit.edu/events/search/?search_include_past=on&search_location=";
	var countries = ["Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegowina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Congo, the Democratic Republic of the", "Cook Islands", "Costa Rica", "Cote d'Ivoire", "Croatia (Hrvatska)", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands", "Fiji", "Finland", "France", "France Metropolitan", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard and Mc Donald Islands", "Holy See (Vatican City State)", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran (Islamic Republic of)", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan", "Lao, People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libyan Arab Jamahiriya", "Liechtenstein", "Lithuania", "Luxembourg", "Macau", "Macedonia, The Former Yugoslav Republic of", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of", "Monaco", "Mongolia", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "Netherlands Antilles", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Seychelles", "Sierra Leone", "Singapore", "Slovakia (Slovak Republic)", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and the South Sandwich Islands", "Spain", "Sri Lanka", "St. Helena", "St. Pierre and Miquelon", "Sudan", "Suriname", "Svalbard and Jan Mayen Islands", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic", "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Virgin Islands (British)", "Virgin Islands (U.S.)", "Wallis and Futuna Islands", "Western Sahara", "Yemen", "Yugoslavia", "Zambia", "Zimbabwe"];

	countries.map(function(country)
	{
		scratchCrawler.queueURL(baseUrl + encodeURIComponent(country));
	});

	scratchCrawler.start();
	scratchCrawler.on("queueadd", function(queueItem) {

		var regex = new RegExp('\/events\/[0-9]+\/', 'g');

		if (queueItem.path.search(regex) != -1) {
			var resume = this.wait();

			phantomQueue.push(queueItem.url);
			processQueue(phantom, resume, getScratchLinks);
		}

	});
}

function runEuroCrawler(phantom) {

	var baseUrl = "http://events.codeweek.eu/view/"
	var range = 20000;

	for (var i = 2661 ; i < range ; i++)
	{
		euroCodeCrawler.queueURL(baseUrl+i);
	}

	euroCodeCrawler.maxDepth = 1;

	euroCodeCrawler.start();

	euroCodeCrawler.on("queueadd", function(queueItem) {

		var regex = new RegExp('\/view\/[0-9]+\/', 'g');

		if (queueItem.path.search(regex) != -1) {
			var resume = this.wait();

			phantomQueue.push(queueItem.url);
			processQueue(phantom, resume, getEuroLinks);
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

function getScratchLinks(phantom, url, callback) {
	console.log("Phantom attempting to load %s ", url);

	if (!url.match(phantomBannedExtensions)) {
		makePage(phantom, url, function(page, status) {
			console.log("Phantom opened URL with %s — %s ", status, url);

			page.evaluate(findScratchEducatorInfo, function(result) {

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
							console.log(mapResult);
							mapResult.results[0].address_components.map(function(item)
							{
								if (item.types.indexOf('country') >= 0)
								{
									code = item.short_name;

									console.log(code);
								}
							});
						}

						resolve(code);
					});
				});

				promise.then(function(code)
				{
					var eventId = url.match('\/view\/(.*)\/');

					if (result.email != "" ||
						result.event != "" ||
						result.organization != "" ||
						result.address != "" ||
						code != "")
					{
						var toWrite = [
							result.firstName,    // First Name
							result.lastName,     // Last Name
							result.email,        // email
							result.event,        // Event Name
							result.organization, // Organiztion
							"",                  // Location
							result.address,      // address
							code,                // country code
							url
						];

						console.log(JSON.stringify(toWrite).green);

						stringifier.write(toWrite);
					}

					callback(page);
				});
			});
		});
	}
	else {
		callback();
	}
}

function getEuroLinks(phantom, url, callback) {
	console.log("Phantom attempting to load %s ", url);

	if (!url.match(phantomBannedExtensions)) {
		makePage(phantom, url, function(page, status) {
			console.log("Phantom opened URL with %s — %s ", status, url);


			page.evaluate(findEuroEducatorInfo, function(result) {
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
					var eventId = url.match('\/view\/(.*)\/');
					console.log("eventId: " + eventId);
					if (result.email != "" ||
						result.event != "" ||
						result.organization != "" ||
						result.address != "" ||
						code != "")
					{
						stringifier.write([
							"",                  // First Name
							"",                  // Last Name
							result.email,        // email
							result.event,        // Event Name
							result.organization, // Organiztion
							"",                  // Location
							result.address,      // address
							code,                // country code
							url
						]);

					}

					callback(page);
				});
			});
		});
	}
	else {
		callback();
	}
}

function findScratchEducatorInfo() {

	var event = {
		firstName: "",
		lastName: "",
		event: "",
		email: "",
		organization: "",
		location: "",
		address: "",
		country_code: ""
	};

	var $desc = $("#event-display");

	var names = $desc.find("#event-name").next().find('a.js-host-link').text().split(" ")

	event.firstName = names[0];
	event.lastName = names[names.length - 1];
	event.email = $desc.find("#event-contact").find("a[href^='mailto:']").attr("href").replace("mailto:", "");
	event.event = $desc.find("#event-name").text();
	event.address = $desc.find("address").text().trim();

	$desc.find(".event--detail--title").each(function (){
		var str = $(this).text();

		if (str.indexOf("Association") != -1) {
			event.organization = $(this).next().text();
		}
	});

	return event;

}

function findEuroEducatorInfo() {
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

function processQueue(phantom, resume, getLink) {
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

		getLink(phantom, item, function(page) {
			// Break up stack so we don't blow it
			if (page) {
				page.close();
			}

			setTimeout(processor.bind(null, phantomQueue.shift()), 10);
		});

	})(phantomQueue.shift());
}

function saveFile(resolve) {

	console.log(output);

	fs.appendFile(currentFileName + dateStr + ".csv", output, function(err) {

		if(err) {
			return console.log(err);
		}

		resolve();

		console.log("The file " + currentFileName + " was saved!");
	});
}