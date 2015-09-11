# Parse Cloud Code
The cloud code for parse focusing on crawling the information of Tickleapp and its opponent daily.

# Install Parse
Run the following script in terminal.
```shell
$ curl -s https://www.parse.com/downloads/cloud_code/installer.sh | sudo /bin/bash
``` 

# Initialization
- Clone the repo.
- Rename ```.parse.local.dist``` to ```.parse.local```
- Add the ```applicationId``` in ```.parse.local```
- Rename ```global.json.dist``` in the ```config``` folder to ```global.json```
- Add the ```applicationId``` and ```masterKey``` in ```global.json```

# Development
- Run ```$ parse develop "Tickle Dashboard"``` in Terminal. Now the parse app will automatically deploy when you make any file change.

# Scheduling Parse Cloud Job
In order to hide the private information of our keys. Make sure you set the ```Parameter``` in scheduling panel when adding new job.

The desired format is:

```json
{
    "consumerSecret": "YOUR_TWITTER_COMSUMER_SECRET_KEY",
    "oauth_consumer_key": "YOUR_TWITTER_COMSUMER_KEY",
    "tokenSecret": "YOUR_TWITTER_ACCESS_TOKEN_SECRET_KEY",
    "oauth_token": "YOUR_TWITTER_ACCESS_TOKEN_KEY"
}
```