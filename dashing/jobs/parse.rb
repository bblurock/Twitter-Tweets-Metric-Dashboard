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

def sendParseDataset

    client = Parse.create :application_id => "C7HX2LIkyy7gVxQWWfNMg6rWLYm03wPa9kIdI3T8", # required
                          :api_key        => "S6uiQbnW4fhJVnVfnKM84vIqzu5M6z59rWXNQhaE", # required
                          :quiet          => false  # optional, defaults to false

    timeline = Array.new
    skip = 0

    loop do

      page = client.query("twitter_user_timeline").tap do |q|
          q.order_by = "createdAt"
          q.order = :descending
          q.skip = skip
          q.limit = 1000
      end.get

      timeline += page

      skip += page.length

      break if page.length == 0
    end

    pp timeline.length
    
    retweetedTimeline = Hash.new
    favoriteTimeLine = Hash.new
    mentionedTimeline = Hash.new
    sharedTwitterTimeline = Hash.new
    sharedOtherTimeline = Hash.new
    followers = Hash.new
    
    retweetedChartData = Array.new
    favoritedChartData = Array.new
    mentionedChartData = Array.new
    sharedTwitterChartData = Array.new
    sharedOtherChartData = Array.new
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
        
        if !mentionedTimeline.include? name
            mentionedTimeline[name] = []
        end
        
        if !sharedTwitterTimeline.include? name
            sharedTwitterTimeline[name] = []
        end

        if !sharedOtherTimeline.include? name
            sharedOtherTimeline[name] = []
        end
        
        if !followers.include? name
            followers[name] = []
        end
        
    
        if record["retweeted"] && record["retweeted"] != 0
            retweeted = record["retweeted"]
            retweetedTimeline[name].push [timestamp, retweeted]
        end
        
        if record["favorited"] && record["favorited"] != 0
            favorited = record["favorited"]
            favoriteTimeLine[name].push [timestamp, favorited]
        end
        
        if record["original_mentioned"] && record["original_mentioned"] != 0
            mentioned = record["original_mentioned"]
            mentionedTimeline[name].push [timestamp, mentioned]
        end
        
        if record["original_shared_twitter"] && record["original_shared_twitter"] != 0
            shared = record["original_shared_twitter"]
            sharedTwitterTimeline[name].push [timestamp, shared]
        end

        if record["original_shared_twitter"] && record["original_shared_twitter"] != 0
            shared = record["original_shared_twitter"]
            sharedOtherTimeline[name].push [timestamp, shared]
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
    
    mentionedTimeline.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        mentionedChartData.push hash
    end
    
    sharedTwitterTimeline.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        sharedTwitterChartData.push hash
    end

    sharedOtherTimeline.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        sharedOtherChartData.push hash
    end
    
    followers.each do |key, array|
        hash = {"name"=>key, "data"=>(groupDataByDate array)}
        followerChartData.push hash
    end

#     puts followerChartData;
    
    send_event('retweeted',  { data: retweetedChartData.to_json })
    send_event('favorited',  { data: favoritedChartData.to_json })
    send_event('mentioned',  { data: mentionedChartData.to_json })
    send_event('followers',  { data: followerChartData.to_json })
    send_event('shared',     { data: sharedTwitterChartData.to_json })
    
end

SCHEDULER.every '180s', :first_in => 0 do |job|
    sendParseDataset
    # send_event('followers',  { data: followerChartData.to_json})
end
