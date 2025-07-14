# -*- coding: utf-8 -*-
'''
    rauth.oauth
    -----------

    A module providing various OAuth related containers.
'''

import base64
import hmac

from hashlib import sha1

from rauth.compat import is_basestring, quote, urlencode, urlsplit, urlunsplit
from rauth.utils import FORM_URLENCODED


class SignatureMethod(object):
    '''
    A base class for signature methods providing a set of common methods.
    '''

    def _ensure_unicode(self, s):
        if not isinstance(s, bytes):
            return s.encode('utf-8')
        return s.decode('utf-8')  # pragma: no cover

    def _escape(self, s):
        '''
        Escapes a string, ensuring it is encoded as a UTF-8 octet.

        :param s: A string to be encoded.
        :type s: str
        '''
        return quote(self._ensure_unicode(s), safe='~').encode('utf-8')

    def _remove_qs(self, url):
        '''
        Removes a query string from a URL before signing.

        :param url: The URL to strip.
        :type url: str
        '''
        scheme, netloc, path, query, fragment = urlsplit(url)

        return urlunsplit((scheme, netloc, path, '', fragment))

    def _normalize_request_parameters(self, oauth_params, req_kwargs):
        '''
        This process normalizes the request parameters as detailed in the OAuth
        1.0 spec.

        Additionally we apply a `Content-Type` header to the request of the
        `FORM_URLENCODE` type if the `Content-Type` was previously set, i.e. if
        this is a `POST` or `PUT` request. This ensures the correct header is
        set as per spec.

        Finally we sort the parameters in preparation for signing and return
        a URL encoded string of all normalized parameters.

        :param oauth_params: OAuth params to sign with.
        :type oauth_params: dict
        :param req_kwargs: Request kwargs to normalize.
        :type req_kwargs: dict
        '''
        normalized = []

        params = req_kwargs.get('params', {})
        data = req_kwargs.get('data', {})
        headers = req_kwargs.get('headers', {})

        # process request parameters
        for k, v in params.items():
            if v is not None:
                normalized += [(k, v)]

        # process request data
        if 'Content-Type' in headers and \
                headers['Content-Type'] == FORM_URLENCODED:
            for k, v in data.items():
                normalized += [(k, v)]

        # extract values from our list of tuples
        all_normalized = []
        for t in normalized:
            k, v = t
            if is_basestring(v) and not isinstance(v, bytes):
                v = v.encode('utf-8')
            all_normalized += [(k, v)]

        # add in the params from oauth_params for signing
        for k, v in oauth_params.items():
            if (k, v) in all_normalized:  # pragma: no cover
                continue
            all_normalized += [(k, v)]

        # sort the params as per the OAuth 1.0/a spec
        all_normalized.sort()

        # finally encode the params as a string
        return urlencode(all_normalized, True)\
            .replace('+', '%20')\
            .replace('%7E', '~')


class HmacSha1Signature(SignatureMethod):
    '''
    HMAC-SHA1 Signature Method.

    This is a signature method, as per the OAuth 1.0/a specs. As the name
    might suggest, this method signs parameters with HMAC using SHA1.
    '''
    NAME = 'HMAC-SHA1'

    def sign(self,
             consumer_secret,
             access_token_secret,
             method,
             url,
             oauth_params,
             req_kwargs):
        '''Sign request parameters.

        :param consumer_secret: Consumer secret.
        :type consumer_secret: str
        :param access_token_secret: Access token secret.
        :type access_token_secret: str
        :param method: The method of this particular request.
        :type method: str
        :param url: The URL of this particular request.
        :type url: str
        :param oauth_params: OAuth parameters.
        :type oauth_params: dict
        :param req_kwargs: Keyworded args that will be sent to the request
            method.
        :type req_kwargs: dict
        '''
        url = self._remove_qs(url)

        oauth_params = \
            self._normalize_request_parameters(oauth_params, req_kwargs)
        parameters = map(self._escape, [method, url, oauth_params])

        key = self._escape(consumer_secret) + b'&'
        if access_token_secret is not None:
            key += self._escape(access_token_secret)

        # build a Signature Base String
        signature_base_string = b'&'.join(parameters)

        # hash the string with HMAC-SHA1
        hashed = hmac.new(key, signature_base_string, sha1)

        # return the signature
        return base64.b64encode(hashed.digest()).decode()


class RsaSha1Signature(SignatureMethod):
    '''
    RSA-SHA1 Signature Method.

    This is a signature method, as per the OAuth 1.0/a specs. As the name
    might suggest, this method signs parameters with RSA using SHA1.
    '''
    NAME = 'RSA-SHA1'

    def __init__(self):
        try:
            from Crypto.PublicKey import RSA as r
            from Crypto.Hash import SHA as s
            from Crypto.Signature import PKCS1_v1_5 as p
            self.RSA, self.SHA, self.PKCS1_v1_5 = r, s, p
        except ImportError:  # pragma: no cover
            raise NotImplementedError('PyCrypto is required for ' + self.NAME)

    def sign(self,
             consumer_secret,
             access_token_secret,
             method,
             url,
             oauth_params,
             req_kwargs):
        '''Sign request parameters.

        :param consumer_secret: RSA private key.
        :type consumer_secret: str or RSA._RSAobj
        :param access_token_secret: Unused.
        :type access_token_secret: str
        :param method: The method of this particular request.
        :type method: str
        :param url: The URL of this particular request.
        :type url: str
        :param oauth_params: OAuth parameters.
        :type oauth_params: dict
        :param req_kwargs: Keyworded args that will be sent to the request
            method.
        :type req_kwargs: dict
        '''
        url = self._remove_qs(url)

        oauth_params = \
            self._normalize_request_parameters(oauth_params, req_kwargs)
        parameters = map(self._escape, [method, url, oauth_params])

        # build a Signature Base String
        signature_base_string = b'&'.join(parameters)

        # resolve the key
        if is_basestring(consumer_secret):
            consumer_secret = self.RSA.importKey(consumer_secret)
        if not isinstance(consumer_secret, self.RSA._RSAobj):
            raise ValueError('invalid consumer_secret')

        # hash the string with RSA-SHA1
        s = self.PKCS1_v1_5.new(consumer_secret)
        # PyCrypto SHA.new requires an encoded byte string
        h = self.SHA.new(signature_base_string)
        hashed = s.sign(h)

        # return the signature
        return base64.b64encode(hashed).decode()


class PlaintextSignature(SignatureMethod):
    '''PLAINTEXT Signature Method.'''
    NAME = 'PLAINTEXT'

    def sign(self, consumer_secret, access_token_secret, method, url,
             oauth_params, req_kwargs):
        '''Sign request using PLAINTEXT method.

        :param consumer_secret: Consumer secret.
        :type consumer_secret: str
        :param access_token_secret: Access token secret (optional).
        :type access_token_secret: str
        :param method: Unused
        :type method: str
        :param url: Unused
        :type url: str
        :param oauth_params: Unused
        :type oauth_params: dict
        :param req_kwargs: Unused
        :type req_kwargs: dict
        '''
        key = self._escape(consumer_secret) + b'&'
        if access_token_secret:
            key += self._escape(access_token_secret)
        return key.decode()
