#!/usr/bin/env python
#
# Copyright 2007 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import webapp2
from google.appengine.api import urlfetch
import json
import logging

class MainHandler(webapp2.RequestHandler):
    def get(self):
        self.response.write('Hello world!')

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

app = webapp2.WSGIApplication([
    ('/', MainHandler),
    ('/ios-review', iOSReviewAPI),
    ('/apple-store', AppleStore),
], debug=True)
