#!/usr/bin/env python

import webapp2
from google.appengine.api import urlfetch, mail
from google.appengine.ext import ndb
import json
import datetime
import logging, traceback, os
from bs4 import BeautifulSoup

error_address = 'mike@tickleapp.com'
sender_address = "Mike@Tickle <mike@tickleapp.com>"
subject = "App Engine Exception for Tickle Dashboard"

class BaseHandler(webapp2.RequestHandler):
    def handle_exception(self, exception, debug_mode):
        logging.info("handle_exception debug_mode = %s" % debug_mode)
        if debug_mode:
            webapp2.RequestHandler.handle_exception(self, exception, debug_mode)
        else:
            #logging.exception(exception)
            #self.error(500)
            #self.response.out.write('<pre>%s</pre>' % traceback.format_exc())
            #self.response.out.write(template.render('templdir/error.html', {}))

            body = "https://appengine.google.com/logs?app_id=s~tickle-dashboard\n\n%s" % traceback.format_exc()
            mail.send_mail(sender_address, error_address, subject, body)
            webapp2.RequestHandler.handle_exception(self, exception, debug_mode)


class TwitterStats(ndb.Model):
    username = ndb.StringProperty(required=True)
    tweets = ndb.IntegerProperty(required=True)
    following = ndb.IntegerProperty(required=True)
    followers = ndb.IntegerProperty(required=True)
    favorites = ndb.IntegerProperty(required=True)
    created = ndb.DateTimeProperty(auto_now_add=True) # internal


class ArchiveTwitterProfiles(webapp2.RequestHandler):
    baseurl = 'https://twitter.com/'
    users = ['tickleapp',
             'wonderworkshop',
             'spheroedu',
             'gotynker',
             'hopscotch',
             'codehs',
             'kodable',
             'codeorg',
             'scratch',
             'trinketapp']

    def toInt(self, str):
        num = str.replace(',', '').lower()
        if num.count('k') > 0:
            num = float(num[:-1]) * 1000
            #logging.info('converting %s => %i' % (str, num))
        num = int(num)
        return num

    def get(self):
        now = datetime.datetime.now()
        # check if we already have stats from today
        last = TwitterStats.query(TwitterStats.username == 'tickleapp').order(-TwitterStats.created).get()
        logging.info('%s: last stats = %s' % (now, last))
        # if same date, skip this run
        if last and now.date() == last.created.date():
            logging.info('same day, skipping this run')
            return
        else:
            logging.info('no data for today yet, fetch Twitter stats')

        stats = []
        for user in self.users:
            url = self.baseurl + user
            result = urlfetch.fetch(url)
            logging.info('fetching: %s' % url)
            if result.status_code == 200:
                soup = BeautifulSoup(result.content)
                tweets = self.toInt(soup.select('li.ProfileNav-item--tweets span.ProfileNav-value')[0].contents[0])
                following = self.toInt(soup.select('li.ProfileNav-item--following span.ProfileNav-value')[0].contents[0])
                followers = self.toInt(soup.select('li.ProfileNav-item--followers span.ProfileNav-value')[0].contents[0])
                favorites = self.toInt(soup.select('li.ProfileNav-item--favorites span.ProfileNav-value')[0].contents[0])
                #logging.info('%s = %s, %s, %s, %s' % (user, tweets, following, followers, favorites))
                self.response.write('%s = %i, %i, %i, %i <br>' % (user, tweets, following, followers, favorites))
                stats.append(TwitterStats(username = user,
                                       tweets = tweets,
                                    following = following,
                                    followers = followers,
                                    favorites = favorites))
            else:
                self.response.write('an error occurred fetching %s<br>' % url)
        #logging.info("stats count = %s" % len(stats))
        keys = ndb.put_multi(stats)
        logging.info('saved Twitter stats: %s' % stats)
        #query = TwitterStats.all()
        #for q in query.run():
        #    logging.info('%s: %s' % (q.username, q.followers))





# fetches the iOS/Mac app review times from Kimono labs, and formats it for the Dash dashboard
class iOSReviewAPI(webapp2.RequestHandler):
    def get(self):
        url = "https://www.kimonolabs.com/api/65ab92xy?apikey=6897a975dea2a52bfae633535c25804f"
        result = urlfetch.fetch(url)
        logging.info(result)
        if result.status_code == 200:
            js = json.loads(result.content)
            #self.response.write(js)
            days = int(js['results']['App Review Times'][0]['iOS'])
            self.response.write(json.dumps({'value': days, 'formatted': '%i days' % days, 'start': '1', 'end': '15'}))
        else:
            self.response('an error occurred')

class AppleStore(webapp2.RequestHandler):
    def get(self):
        url = 'http://store.apple.com/us'
        result = urlfetch.fetch(url)
        self.response.write(result.status_code)




class MainHandler(BaseHandler):
    def get(self):
        self.response.write('Hello! %s' % self.request.headers)

def isDevelopment():
    if os.environ['SERVER_SOFTWARE'].startswith('Development'):
        return True
    else:
        return False

app = webapp2.WSGIApplication([
    ('/', MainHandler),
    #('/', ArchiveTwitterProfiles),
    ('/archive-twitter', ArchiveTwitterProfiles),
    ('/ios-review', iOSReviewAPI),
    ('/apple-store', AppleStore),
#], debug=False)
], debug=isDevelopment())
