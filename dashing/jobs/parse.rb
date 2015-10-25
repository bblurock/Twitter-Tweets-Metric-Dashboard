require 'parse-ruby-client'
require 'json'
require 'rest-client'
require 'pp'

ENV['TZ']='Asia/Taipei'

def groupDataByDate(data)
    data.sort! {|x, y| x[0].to_i<=>y[0].to_i}

    # Convert accumlated data into differentiated data
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

def getTimelineData(client, table)
    result = Array.new
    skip = 0

    maxCreatedAtTime = 0;

    loop do

      page = client.query(table).tap do |q|
          q.order_by = "createdAt"
          q.order = :descending
          q.limit = 1000

          if maxCreatedAtTime != 0
              q.less_than("createdAt", maxCreatedAtTime)
          end
      end.get

      result += page

      if page.length != 0
        maxCreatedAtTime = page[page.length - 1]["createdAt"]
      end

      break if page.length == 0
    end

    result
end

def claculateShared(tweets)

    sharedArray = Hash.new
    groupedSharedArray = Array.new

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

        if !tweet["entities_media"].nil? && !tweet["text"].include?('RT @') && (tweet["user_screen_name"] != name)
            sharedArray[name][timeStr] += 1
        end

    end

    # Format grouping data
    sharedArray.each do |key, array|
        result = Array.new

        array.each do |dateKey, num|
            result.push [DateTime.parse(dateKey).to_time.to_i * 1000, num]
        end

        # Sorting timestamp
        result.sort! {|x, y| x[0].to_i<=>y[0].to_i}

        hash = {"name"=>key, "data"=>result}

        groupedSharedArray.push hash
    end

    groupedSharedArray

end

def claculateMentioned(tweets)

    mentionedArray = Hash.new
    groupedMentionedArray = Array.new

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

        if !tweet["in_reply_to_status_id"].nil? && !tweet["text"].include?('RT @') && (tweet["user_screen_name"] != name)
            mentionedArray[name][timeStr] += 1
        end

    end

    # Format grouping data
    mentionedArray.each do |key, array|
        result = Array.new

        array.each do |dateKey, num|
            result.push [DateTime.parse(dateKey).to_time.to_i * 1000, num]
        end

        # Sorting timestamp
        result.sort! {|x, y| x[0].to_i<=>y[0].to_i}

        hash = {"name"=>key, "data"=>result}

        groupedMentionedArray.push hash
    end

    groupedMentionedArray

end

def sendParseDataset

    client = Parse.create :application_id => "C7HX2LIkyy7gVxQWWfNMg6rWLYm03wPa9kIdI3T8", # required
                          :api_key        => "S6uiQbnW4fhJVnVfnKM84vIqzu5M6z59rWXNQhaE", # required
                          :quiet          => false  # optional, defaults to false

    timeline = Array.new
    tweets = Array.new

    # Get Data from Parse.com
    tweets = getTimelineData(client, "metioning_history")
    groupedMentionedArray = claculateMentioned(tweets)
    groupedSharedArray = claculateShared(tweets)

    # Get Data from Parse.com
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
        pp key
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        retweetedChartData.push hash
    end

    favoriteTimeLine.each do |key, array|
        pp key
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        favoritedChartData.push hash
    end

    followers.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        followerChartData.push hash
    end

    send_event('retweeted',  { data: retweetedChartData.to_json })
    send_event('favorited',  { data: favoritedChartData.to_json })
    send_event('followers',  { data: followerChartData.to_json })
    send_event('mentioned',  { data: groupedMentionedArray.to_json })
    send_event('shared',     { data: groupedSharedArray.to_json })

end

SCHEDULER.every '180s', :first_in => 0 do |job|
    sendParseDataset
end
