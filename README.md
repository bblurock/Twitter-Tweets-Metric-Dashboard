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

### Usage:
#### for crawling ScratchDay
> node index.js -s

#### for crawling EU Code Week
> node index.js -e

### Output
The output will be located in ```output``` as ```scratch-day-{date}.csv``` or ```euro-code-week-{date}.csv```
