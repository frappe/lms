# -*- coding: utf-8 -*-
'''
    rauth.utils
    -----------

    General utilities.
'''

from rauth.compat import quote, parse_qsl, is_basestring

from requests.structures import CaseInsensitiveDict as cidict
from requests.auth import AuthBase

FORM_URLENCODED = 'application/x-www-form-urlencoded'
ENTITY_METHODS = ('POST', 'PUT', 'PATCH')
OPTIONAL_OAUTH_PARAMS = ('oauth_callback', 'oauth_verifier', 'oauth_version')


def absolute_url(url):
    return url.startswith(('http://', 'https://'))


def parse_utf8_qsl(s):
    d = dict()

    for k, v in dict(parse_qsl(s)).items():  # pragma: no cover
        if not isinstance(k, bytes) and not isinstance(v, bytes):
            # skip this iteration if we have no keys or values to update
            continue
        if isinstance(k, bytes):
            k = k.decode('utf-8')
        if isinstance(v, bytes):
            v = v.decode('utf-8')
        d[k] = v
    return d


def get_sorted_params(params):
    def sorting_gen():
        for k in sorted(params.keys()):
            yield '='.join((k, params[k]))
    return '&'.join(sorting_gen())


class CaseInsensitiveDict(cidict):
    def __init__(self, d=None):
        lowered_d = {}

        if d is not None:
            if isinstance(d, dict):
                lowered_d = self._get_lowered_d(d)
            elif isinstance(d, list):
                return self.__init__(dict(d))

        return super(CaseInsensitiveDict, self).__init__(lowered_d)

    def _get_lowered_d(self, d):
        lowered_d = {}
        for key in d:
            if is_basestring(key):
                lowered_d[key.lower()] = d[key]
            else:  # pragma: no cover
                lowered_d[key] = d[key]
        return lowered_d

    def setdefault(self, key, default):
        if is_basestring(key):
            key = key.lower()

        super(CaseInsensitiveDict, self).setdefault(key, default)

    def update(self, d):
        super(CaseInsensitiveDict, self).update(self._get_lowered_d(d))


class OAuth2Auth(AuthBase):
    ''' Attaches OAuth 2 Authentication to a given Request object. '''
    def __init__(self, access_token):
        self.access_token = access_token

    def __call__(self, r):
        r.headers['Authorization'] = 'Bearer ' + self.access_token
        return r


class OAuth1Auth(AuthBase):
    ''' Attaches OAuth 1 Authentication to a given Request object. '''
    def __init__(self, oauth_params, realm=None):
        self.oauth_params = oauth_params
        self.realm = realm or ''

    def _get_auth_header(self):
        ''' Constructs and returns an authentication header. '''
        realm = 'realm="{realm}"'.format(realm=self.realm)
        params = ['{k}="{v}"'.format(k=k, v=quote(str(v), safe=''))
                  for k, v in self.oauth_params.items()]
        return 'OAuth ' + ','.join([realm] + params)

    def __call__(self, r):
        r.headers['Authorization'] = self._get_auth_header()
        return r
