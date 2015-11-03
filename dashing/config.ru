require 'omniauth-google-oauth2'
require 'sinatra'

enable :sessions

def logger; settings.logger end

def user_credentials
  # Build a per-request oauth credential based on token stored in session
  # which allows us to use a shared API client.
  @authorization ||= (
    auth = settings.authorization.dup
    auth.redirect_uri = to('/oauth2callback')
    auth.update_token!(session)
    auth
  )
end

set :views, "#{settings.root}/dashboards"

configure do
  log_file = File.open('p.log', 'a+')
  log_file.sync = true
  logger = Logger.new(log_file)
  logger.level = Logger::DEBUG

  set :logger, logger
end

get '/' do
  if (session[:access_token].nil?  && session[:expires_at].nil?)
    redirect to('/auth/google_oauth2')
  else
    redirect to('/twitter')
  end
end

get '/auth/:provider/callback' do
  content_type 'text/plain'
  auth = request.env['omniauth.auth'].to_hash

  session[:access_token] = auth['credentials']['token']
  session[:expires_at] = auth['credentials']['expires_at']

  redirect to('/twitter')
end

get '/auth/failure' do
  content_type 'text/plain'
  request.env['omniauth.auth'].to_hash.inspect rescue "No Data"
end

get '/twitter' do

  if (session[:access_token].nil?  && session[:expires_at].nil?)
      redirect to('/auth/google_oauth2')
  end

  erb :layout, :layout => false do
    erb :twitter
  end

end

# Delay loading Hack, in order to make routing works
# See: https://github.com/Shopify/dashing/issues/138#issuecomment-24894956
require 'dashing'

use Rack::Session::Cookie, :secret => ENV['RACK_COOKIE_SECRET']

use OmniAuth::Builder do
  # For additional provider examples please look at 'omni_auth.rb'
  provider :google_oauth2, ENV['GOOGLE_KEY'], ENV['GOOGLE_SECRET'], { :hd => "tickleapp.com" }
end


map Sinatra::Application.assets_prefix do
  run Sinatra::Application.sprockets
end

run Sinatra::Application