# Dashing

### Description
This is the Dashboard for multiple analytics metrics of our interested twitter accounts(screenName).

![screen shot 2015-11-18 at 9 47 40 am](https://cloud.githubusercontent.com/assets/2673743/11230375/5b5d10e8-8dd9-11e5-942c-eba2b2283f65.png)

### There are five main widget:
- Daily followers growth
- Daily mentioned
  - If a tweet is contains screenName of this account, and
  - If a tweet is not tweet by its owner, and
  - If a tweet is original tweets, and
  - Then this tweet is counted as one mentioned
- Daily shared
  - If a tweet is not tweet by its owner, and
  - If a tweet is original tweets, and
  - media url contains
   - vine
   - instagram
   - youtube.com
   - youtu.be
   - twitter
- Daily retweeted
  - Each tweets calculation task of a screenName we will have a query window, normally contains 3200 of tweets(constrained by Twitter API). Of course, the historical tweets of one account is far more than 3200 tweets. The calculation will add up each tweets metrics within this window and every historical tweets
- Daily favorited
 - same as retweeted

### Dashboard Tools
- shopify/Dashing
- HighStock
- adelevie/parse-ruby-client 

### File structure
- dashing/
  - jobs/ - Ruby backend's jobs
  - dashboards/ - Dashboards layout
  - widgets/ - individual widgets
  - assets
    - javascripts
    - application.coffee - javascript entry point
  - config.ru - ruby entry point, where OAuth lives

### Usage
- Set up ENV Path of the following
  - ENV['RACK_COOKIE_SECRET'] - random key
  - ENV['GOOGLE_KEY'] - google app public key
  - ENV['GOOGLE_SECRET'] - google app secret key
  - ENV['PARSE_API_KEY']
  - ENV['PARSE_APPLICATION_ID']
  - ENV['TWITTER_CONSUMER_KEY']
  - ENV['TWITTER_CONSUMER_SECRET']
  - ENV['TWITTER_ACCESS_TOKEN']
  - ENV['TWITTER_ACCESS_TOKEN_SECRET']
- In terminal, run ```dashing start```

### Deploying
- In root directory, run ```git subtree push --prefix dashing heroku-dashboard master``` , 'dashing' is the sub-directory name, 'heroku-dashboard' is your heroku git(you have to set the remote link), 'master' is the heroku default branch

# Dashboard Parse Worker
### Description
This Parse Cloud code and be run in pure NodeJS environment. We deploy it on Heroku [tickle-dashboard-worker](https://dashboard.heroku.com/apps/tickle-dashboard-worker/resources) and set with a scheduler running every hour.

### Usage
In local environment, we use [parse-cloud-runner](https://github.com/tickleapp/parse-cloudcode-runner) as a NodeJS wrapper.

- Set the following code after require of ```./cloud/main.js```
```javascript
if (typeof Parse === 'undefined') {
    var Parse = require('parse-cloudcode-runner').Parse;
    Parse.initialize({PARSE_APPLICATION_ID}, {PARSE_JAVASCRIPT_KEY}, {PARSE_MASTER_KEY});
}
```

- In "twitterParser" job, set
```javascript
consumerSecret     : {consumerSecret},
oauth_consumer_key : {oauth_consumer_key},
tokenSecret        : {tokenSecret},
oauth_token        : {oauth_token},
```

- Run the following in Terminal
 - ```./node_modules/.bin/parse-cloudcode-runner testParseSave -t job```

### Deploying
In root directory, run ```git subtree push --prefix parse heroku-worker master``` , 'parse' is the sub-directory name, 'heroku-worker' is your heroku git(you have to set the remote link), 'master' is the heroku default branch

# Educator Cralwer
### Description:
This Crawler using [cgiffard/simplecraler](https://github.com/cgiffard/node-simplecrawler), and PhantomJS to crawl the following websites:

- http://events.codeweek.eu/
- http://day.scratch.mit.edu/

#### Euro Code week
The links to be crawled structure like this ```http://events.codeweek.eu/view/{evebt_number}```

Hence, we push a list of url, ```http://events.codeweek.eu/view/1``` ~ ```http://events.codeweek.eu/view/20000```, for example. And let the PhantonJS run.

##### Code Snippet: 
```javascript
  var baseUrl = "http://events.codeweek.eu/view/"
	var range = 20000,
		offset = 2661;	

	for (var i = offset ; i < range ; i++) {
		euroCodeCrawler.queueURL(baseUrl+i);
		phantomQueue.push(baseUrl+i);
	}

	processQueue(phantom, function() {}, getEuroLinks);
```

#### ScratchDay
The links to be crwaled of ScratchDay structured like this ```http://day.scratch.mit.edu/events/search/?search_location={Country}```

We utilized this countried array
```javascript
var countries = ["Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegowina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Congo, the Democratic Republic of the", "Cook Islands", "Costa Rica", "Cote d'Ivoire", "Croatia (Hrvatska)", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands", "Fiji", "Finland", "France", "France Metropolitan", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard and Mc Donald Islands", "Holy See (Vatican City State)", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan", "Lao, People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libyan Arab Jamahiriya", "Liechtenstein", "Lithuania", "Luxembourg", "Macau", "Macedonia, The Former Yugoslav Republic of", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Moldova, Republic of", "Monaco", "Mongolia", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "Netherlands Antilles", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Poland", "Portugal", "Puerto Rico", "Qatar", "Reunion", "Romania", "Russian Federation", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Seychelles", "Sierra Leone", "Singapore", "Slovakia (Slovak Republic)", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and the South Sandwich Islands", "Spain", "Sri Lanka", "St. Helena", "St. Pierre and Miquelon", "Sudan", "Suriname", "Svalbard and Jan Mayen Islands", "Swaziland", "Sweden", "Switzerland", "Syrian Arab Republic", "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela", "Vietnam", "Virgin Islands (British)", "Virgin Islands (U.S.)", "Wallis and Futuna Islands", "Western Sahara", "Yemen", "Yugoslavia", "Zambia", "Zimbabwe"];
```

to compose the links.

Different from Euro Code week, these links are the list pages of events that near the query location. One have to click on the item to enter event page. Here's where SimpleCrawler comes in hand, the crawler will traverse every link apears on the page, and recursive until there's no more un-visited links.

#### Before Run
The crawler make use of Google Map API, run the following in terminal
> export GMAP_PRIVAT_KEY={your_gmap_key}

### Usage:
#### for crawling ScratchDay
> node index.js -s

#### for crawling EU Code Week
> node index.js -e

### Output
The output will be located in ```output``` as ```scratch-day-{date}.csv``` or ```euro-code-week-{date}.csv```
