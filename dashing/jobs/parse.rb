require 'parse-ruby-client'
require 'json'
require 'rest-client'
require 'pp'

ENV['TZ']='UTC'

def groupDataByDate(data)
    # sort by timestamp
    data.sort! {|x, y| x[0].to_i<=>y[0].to_i}

    # Convert accumlated data into differentiated data, ex: the number of follower grow every date, however, we want to show differentiated number of every day 
    diff = Array.new
    data.each_index { |i|
        if (i - 1).to_i >= 0
            diff.push [data[i][0], data[i][1] - data[(i - 1).to_i][1]]
        else
            diff.push [data[i][0], 0]
        end
    }

    # Grouping by date
    group = Hash.new
    diff.each do |ts, data|
        timeStr = Time.at(ts/1000).to_datetime.strftime "%Y-%m-%d"
        if !group.include? timeStr
            group[timeStr] = 0
        end
        group[timeStr] = group[timeStr] + data
    end

    # Format grouping data
    result = Array.new
    group.each do |dateKey, num|
        result.push [DateTime.parse(dateKey).to_time.to_i * 1000, num]
    end

    result
end

# mergeMetrics
# --------
#
# Merge the new calculted shared data into the old one 
def mergeMetrics(target, metrics, pageMetrics)
    pageMetrics[target].each do |name, timesStrings|
        # Init non-existing screen_name
        if !metrics[target].include? name
            metrics[target][name] = Hash.new
        end
        
        timesStrings.each do |timeStr, number| 
            # Init grouping by Date
            if !metrics[target][name].include? timeStr
                metrics[target][name][timeStr] = 0
            end
            metrics[target][name][timeStr] += number
        end

    end
end

# getTimelineData
# --------
#
# Get data from Parse.com
#
# ＠param {object} Parse object 
# @return {string} Parse table name
def getTimelineData(client, table)
    result = Array.new
    metrics = Hash.new
    metrics["shared"] = Hash.new 
    metrics["mentioned"] = Hash.new 
    skip = 0

    maxCreatedAtTime = 0;

    loop do

      # Parse only allow fetching 1000 records with one query
      page = client.query(table).tap do |q|
          q.order_by = "createdAt"
          q.order = :descending
          q.limit = 1000

          if maxCreatedAtTime != 0
              q.less_than("createdAt", maxCreatedAtTime)
          end
      end.get
      
      if page.length != 0
        maxCreatedAtTime = page[page.length - 1]["createdAt"]
      end
      
      # Blocks given means we should do the calculation on the fly when getting data from Parse.com
      if block_given?
        pageMetrics = Hash.new
        
        # Current page's metric is calculated by block given
        pageMetrics = yield page 
        
        # Merge the new calculted shared data into the old one
        mergeMetrics("shared", metrics, pageMetrics);
        # Merge the new calculted mentioned data into the old one
        mergeMetrics("mentioned", metrics, pageMetrics);        
      else
        # If No Calculation Needs to be done
        result += page
      end

      break if page.length == 0
      
      page = nil;
    end

    if result.empty? then metrics else result end
end


# claculateShared
# --------
#
# Grouping raw tweets into a two dimentional array with in [name][tweetTimeString], the value indicates the number of tweets containing media
#
# ＠param {array} tweets The raw tweets 
# @return {array} Grouped by name and date
def claculateShared(tweets)

    sharedArray = Hash.new

    for tweet in tweets
        name = tweet["mentioning"]
        timestamp = DateTime.parse(tweet["created_at"]).to_time.to_i * 1000
        timeStr = Time.at(timestamp/1000).to_datetime.strftime "%Y-%m-%d"

        # Init non-existing screen_name
        if !sharedArray.include? name
            sharedArray[name] = Hash.new
        end

        # Init grouping by Date
        if !sharedArray[name].include? timeStr
            sharedArray[name][timeStr] = 0
        end

        # Exclude Retweet an Tweet mentioning himself
        if !tweet["text"].include?('RT @') && (tweet["user_screen_name"] != name)

            # Tweets containing image or video
            if !tweet["entities_media"].nil?
                sharedArray[name][timeStr] += 1
            end

            # We count resource like youtube, instagram, vimeo, vine
            if !tweet["entities_urls"].nil?
                urls = JSON.parse(tweet["entities_urls"])
                 
                for url in urls
                    if (url['expanded_url'].include?('youtube.com')   ||
                        url['expanded_url'].include?('youtu.be')      ||
                        url['expanded_url'].include?('instagram.com') ||
                        url['expanded_url'].include?('vimeo.com')     ||
                        url['expanded_url'].include?('vine.co'))
                        sharedArray[name][timeStr] += 1
                        break
                    end
                end
            end
        end
    end
    
    sharedArray
end

# claculateMentioned
# --------
#
# Grouping raw tweets into a two dimentional array with in [name][tweetTimeString], the value indicates the number of tweets that mentioning each user
#
# ＠param {array} tweets The raw tweets 
# @return {array} Grouped by name and date
def claculateMentioned(tweets)

    mentionedArray = Hash.new
    
    for tweet in tweets
        name = tweet["mentioning"]
        timestamp = DateTime.parse(tweet["created_at"]).to_time.to_i * 1000
        timeStr = Time.at(timestamp/1000).to_datetime.strftime "%Y-%m-%d"

        # Init non-existing screen_name
        if !mentionedArray.include? name
            mentionedArray[name] = Hash.new
        end

        # Init grouping by Date
        if !mentionedArray[name].include? timeStr
            mentionedArray[name][timeStr] = 0
        end

        # Exclude Retweet an Tweet mentioning himself
        if !tweet["in_reply_to_status_id"].nil? && !tweet["text"].include?('RT @') && (tweet["user_screen_name"] != name)
            mentionedArray[name][timeStr] += 1
        end
    end
    
    mentionedArray
end

# groupeHashIntoKeyData
# --------
#
# The data required by Highstock widget should be format in this form {"name"=> {screenName}, "data" => {timestamp}}   
#
# ＠param {array} tweets The raw tweets 
# @return {array} Array of hash
def groupeHashIntoKeyData(inputHash)

    groupedArray = Array.new
    
    # Format grouping data
    inputHash.each do |key, array|
        result = Array.new

        array.each do |dateKey, num|
            result.push [DateTime.parse(dateKey).to_time.to_i * 1000, num]
        end

        # Sorting timestamp
        result.sort! {|x, y| x[0].to_i<=>y[0].to_i}

        hash = {"name"=>key, "data"=>result}

        groupedArray.push hash
    end
    
    groupedArray
end


# sendParseDataset
# --------
#
# Main function   
#
def sendParseDataset
    # All the data used by this script is fetch by Parse API
    # Hence, you might need to set up your PARSE_APPLICATION_ID and PARSE_API_KEY in ENV
    client = Parse.create :application_id => ENV["PARSE_APPLICATION_ID"], # required
                          :api_key        => ENV["PARSE_API_KEY"], # required
                          :quiet          => false  # optional, defaults to false

    timeline = Array.new
    mentionedAndShared = Hash.new

    # Get Data from Parse.com, we provides a block which calculate the fetched data on the fly
    mentionedAndShared = getTimelineData(client, "metioning_history") { |tweets| 
      metrics = Hash.new
      
      metrics["mentioned"] = claculateMentioned(tweets)
      metrics["shared"] = claculateShared(tweets)
      
      metrics
    }
    
    # Caculated Mentioning Tweets
    mentionedAndShared["mentioned"] = groupeHashIntoKeyData(mentionedAndShared["mentioned"]);
    mentionedAndShared["mentioned"].sort! {|x, y| x['name']<=>y['name']}
    send_event('mentioned', { data: mentionedAndShared["mentioned"].to_json })
    
    # Reset
    mentionedAndShared["mentioned"] = Hash.new
    
    # Caculated Mentioning Shared
    mentionedAndShared["shared"] = groupeHashIntoKeyData(mentionedAndShared["shared"]);
    mentionedAndShared["shared"].sort! {|x, y| x['name']<=>y['name']}
    send_event('shared', { data: mentionedAndShared["shared"].to_json })
    
    # Reset
    mentionedAndShared["shared"] = Hash.new

    # Get Data from Parse.com of users' historical status
    timeline = getTimelineData(client, "twitter_user_timeline")

    retweetedTimeline = Hash.new
    favoriteTimeLine = Hash.new
    followers = Hash.new

    retweetedChartData = Array.new
    favoritedChartData = Array.new
    followerChartData = Array.new

    # Grouping data by "screen_name"
    for record in timeline

        name = record["screen_name"]
        timestamp = DateTime.parse(record["createdAt"]).to_time.to_i * 1000

        if !retweetedTimeline.include? name
            retweetedTimeline[name] = []
        end

        if !favoriteTimeLine.include? name
            favoriteTimeLine[name] = []
        end

        if !followers.include? name
            followers[name] = []
        end

        if record["historicalRetweet"] && record["historicalRetweet"] != 0
            retweeted = record["historicalRetweet"]
            retweetedTimeline[name].push [timestamp, retweeted]
        end

        if record["historicalFavorite"] && record["historicalFavorite"] != 0
            favorited = record["historicalFavorite"]
            favoriteTimeLine[name].push [timestamp, favorited]
        end

        if record["followers"] && record["followers"] != 0
            follower = record["followers"]
            followers[name].push [timestamp, follower]
        end

    end

    retweetedTimeline.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        retweetedChartData.push hash
    end

    favoriteTimeLine.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        favoritedChartData.push hash
    end

    followers.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        followerChartData.push hash
    end

    retweetedChartData.sort! {|x, y| x['name']<=>y['name']}
    favoritedChartData.sort! {|x, y| x['name']<=>y['name']}
    followerChartData.sort! {|x, y| x['name']<=>y['name']}

    send_event('retweeted',  { data: retweetedChartData.to_json })
    send_event('favorited',  { data: favoritedChartData.to_json })
    send_event('followers',  { data: followerChartData.to_json })
    
    retweetedTimeline = Hash.new
    favoriteTimeLine = Hash.new
    followers = Hash.new
    
    retweetedChartData = Array.new 
    favoritedChartData = Array.new
    followerChartData = Array.new
    timeline = Array.new
end

SCHEDULER.every '60s', :first_in => 0 do |job|
    sendParseDataset
end
