require 'twitter'
require 'json'
require 'pp'

twitter = Twitter::REST::Client.new do |config|
  config.consumer_key = '6IaI7dBybFyO1jkHmAk4b0yzq'
  config.consumer_secret = 'LJHmSWvJxv3QboKAlz1SFJCTmvH04hQOjB5MD7liR0DIRNBc4z'
  config.access_token = '498587847-UXzfxjpA7W5rgz8c8sPhrmNtUbYswugPU2ohzUAO'
  config.access_token_secret = 'BuLLnw2Eu8turGO2S7MagDyCxA8oQU0unSVxVtH85OX4z'
end

search_term = URI::encode('@tickleapp')

SCHEDULER.every '30s', :first_in => 0 do |job|
  begin
    timelines = Array.new
    users = ["tickleapp", "wonderworkshop", "spheroedu", "gotynker", "hopscotch", "codehs", "kodable", "codeorg", "scratch", "trinketapp"]

    users.each do |user|
      timeline = twitter.user(user);
      pp user

      if timeline
        hash = {
          name: timeline.screen_name,
          follower: timeline.followers_count,
          favorites: timeline.favourites_count,
          tweets: timeline.statuses_count,
          description: timeline.description,
          profile_image_url: timeline.profile_image_url,
          profile_banner_url: timeline.profile_banner_url
        }
       timelines.push hash
      end

    end

    send_event('users', data: timelines)

  end
end

SCHEDULER.every '10m', :first_in => 0 do |job|
  begin
    tweets = twitter.search("#{search_term}")

    if tweets
      tweets = tweets.map do |tweet|
        { name: tweet.user.name, body: tweet.text, avatar: tweet.user.profile_image_url_https }
      end
      send_event('twitter_mentions', comments: tweets)
    end
  rescue Twitter::Error
    puts "\e[33mFor the twitter widget to work, you need to put in your twitter API keys in the jobs/twitter.rb file.\e[0m"
  end
end
