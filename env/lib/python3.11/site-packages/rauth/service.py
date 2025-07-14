# -*- coding: utf-8 -*-
'''
    rauth.service
    -------------

    Provides OAuth 1.0/a, 2.0 and Ofly service containers.
'''

from rauth.compat import urlencode
from rauth.session import OAuth1Session, OAuth2Session, OflySession
from rauth.utils import ENTITY_METHODS, parse_utf8_qsl

PROCESS_TOKEN_ERROR = ('Decoder failed to handle {key} with data as returned '
                       'by provider. A different decoder may be needed. '
                       'Provider returned: {raw}')


def process_token_request(r, decoder, *args):
    try:
        data = decoder(r.content)
        return tuple(data[key] for key in args)
    except KeyError as e:  # pragma: no cover
        bad_key = e.args[0]
        raise KeyError(PROCESS_TOKEN_ERROR.format(key=bad_key, raw=r.content))


class Service(object):
    __attrs__ = ['name', 'base_url', 'authorize_url']

    def __init__(self, name, base_url, authorize_url):
        #: The service name, e.g. 'twitter'.
        self.name = name

        #: The base URL used for making API requests.
        self.base_url = base_url

        #: The authorization URL.
        self.authorize_url = authorize_url

    def __getstate__(self):
        return dict((attr, getattr(self, attr, None)) for
                    attr in self.__attrs__)

    def __setstate__(self, state):
        for attr, value in state.items():
            setattr(self, attr, value)


class OAuth1Service(Service):
    '''
    An OAuth 1.0/a Service container.

    This class provides a wrapper around a specialized Requests'
    :class:`~requests.sessions.Session` object. Primarily this wrapper is used
    to produce authenticated session objects. These may be used to make
    requests against OAuth 1.0/a endpoints.

    You might intialize :class:`OAuth1Service` something like
    this::

        service = OAuth1Service(
                   name='example',
                   consumer_key='123',
                   consumer_secret='456',
                   request_token_url='http://example.com/request_token',
                   access_token_url='http://example.com/access_token',
                   authorize_url='http://example.com/authorize',
                   base_url='http://example.com/api')

    Now the request token should be retrieved::

        request_token, request_token_secret = service.get_request_token()

    .. admonition:: Differing Request Token Formats

        Some services provide different formatting when returning tokens. For
        this reason the service wrapper provides a special method
        :meth:`get_raw_request_token`. This will return the unparsed response.
        At this point it's up to you to extract the necessary data.

    It's time to access the authorize URI and direct the client to authorize
    requests on their behalf. This URI is retrieved as follows::

        authorize_url = service.get_authorize_url(request_token)

    Once the client has authorized the request it is now possible to retrieve
    an access token. Do so as follows::

        session = service.get_auth_session(request_token, request_token_secret)

    .. admonition:: Differing Access Token Formats

        Some services provide different formatting when returning tokens. For
        this reason the service wrapper provides a special method
        :meth:`get_raw_access_token`. This will return the unparsed response.
        At this point it's up to you to extract the necessary data.

    Finally we have an authenticated session and are ready to make requests
    against OAuth 1.0/a endpoints. Because Rauth is a wrapper around
    Requests, the same API you would use with Requests is exposed and
    expected::

        r = session.get('some/resource/', params={'format': 'json'})
        print r.json()

    :param consumer_key: Client consumer key, required for signing.
    :type consumer_key: str
    :param consumer_secret: Client consumer secret, required for signing.
    :type consumer_secret: str
    :param name: The service name, defaults to `None`.
    :type name: str
    :param request_token_url: Request token endpoint, defaults to `None`.
    :type request_token_url: str
    :param access_token_url: Access token endpoint, defaults to `None`.
    :type access_token_url: str
    :param authorize_url: Authorize endpoint, defaults to `None`.
    :type authorize_url: str
    :param base_url: A base URL from which to construct requests, defaults to
        `None`.
    :type base_url: str
    :param session_obj: Object used to construct sessions with, defaults to
        :class:`rauth.OAuth1Session <OAuth1Session>`
    :type session_obj: :class:`Session`
    :param signature_obj: Object used to construct signatures with, defaults
         to :class:`rauth.oauth.HmacSha1Signature <HmacSha1Signature>`
    :type signature_obj: :class:`SignatureMethod`
    '''
    __attrs__ = Service.__attrs__ + ['consumer_key',
                                     'consumer_secret',
                                     'request_token_url',
                                     'access_token_url',
                                     'session_obj']

    def __init__(self,
                 consumer_key,
                 consumer_secret,
                 name=None,
                 request_token_url=None,
                 access_token_url=None,
                 authorize_url=None,
                 base_url=None,
                 session_obj=None,
                 signature_obj=None):

        #: Client credentials.
        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret

        #: Authorization endpoints.
        self.request_token_url = request_token_url
        self.access_token_url = access_token_url

        #: Object used to construct sessions with.
        self.session_obj = session_obj or OAuth1Session

        #: Object used to construct signatures with.
        self.signature_obj = signature_obj

        #: Request and access token responses.
        self.request_token_response = None
        self.access_token_response = None

        super(OAuth1Service, self).__init__(name,
                                            base_url,
                                            authorize_url)

    def get_session(self, token=None, signature=None):
        '''
        If provided a `token` parameter, tries to retrieve a stored
        `rauth.OAuth1Session` instance. Otherwise generates a new session
        instance with the :class:`rauth.OAuth1Service.consumer_key` and
        :class:`rauth.OAuth1Service.consumer_secret` stored on the
        `rauth.OAuth1Service` instance.

        :param token: A tuple of strings with which to memoize the session
            object instance.
        :type token: tuple
        '''
        if token is not None:
            access_token, access_token_secret = token
            session = self.session_obj(self.consumer_key,
                                       self.consumer_secret,
                                       access_token,
                                       access_token_secret,
                                       signature or self.signature_obj,
                                       service=self)
        else:  # pragma: no cover
            signature = signature or self.signature_obj
            session = self.session_obj(self.consumer_key,
                                       self.consumer_secret,
                                       signature=signature,
                                       service=self)
        return session

    def get_raw_request_token(self, method='GET', **kwargs):
        '''
        Returns a Requests' response over the
        :attr:`rauth.OAuth1Service.request_token_url`.

        Use this if your endpoint if you need the full `Response` object.

        :param method: A string representation of the HTTP method to be used,
            defaults to `GET`.
        :type method: str
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        # ensure we've set the request_token_url
        if self.request_token_url is None:
            raise TypeError('request_token_url must not be None')

        session = self.get_session()
        self.request_token_response = session.request(method,
                                                      self.request_token_url,
                                                      **kwargs)
        return self.request_token_response

    def get_request_token(self,
                          method='GET',
                          decoder=parse_utf8_qsl,
                          key_token='oauth_token',
                          key_token_secret='oauth_token_secret',
                          **kwargs):
        '''
        Return a request token pair.

        :param method: A string representation of the HTTP method to be used,
            defaults to `GET`.
        :type method: str
        :param decoder: A function used to parse the Response content. Should
            return a dictionary.
        :type decoder: func
        :param key_token: The key the access token will be decoded by, defaults
            to 'oauth_token'.
        :type string:
        :param key_token_secret: The key the access token will be decoded by,
            defaults to 'oauth_token_secret'.
        :type string:
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        r = self.get_raw_request_token(method=method, **kwargs)
        request_token, request_token_secret = \
            process_token_request(r, decoder, key_token, key_token_secret)
        return request_token, request_token_secret

    def get_authorize_url(self, request_token, **params):
        '''
        Returns a formatted authorize URL.

        :param request_token: The request token as returned by
            :class:`get_request_token`.
        :type request_token: str
        :param \*\*params: Additional keyworded arguments to be added to the
            request querystring.
        :type \*\*params: dict
        '''
        params.update({'oauth_token': request_token})
        return self.authorize_url + '?' + urlencode(params)

    def get_raw_access_token(self,
                             request_token,
                             request_token_secret,
                             method='GET',
                             **kwargs):
        '''
        Returns a Requests' response over the
        :attr:`rauth.OAuth1Service.access_token_url`.

        Use this if your endpoint if you need the full `Response` object.

        :param request_token: The request token as returned by
            :meth:`get_request_token`.
        :type request_token: str
        :param request_token_secret: The request token secret as returned by
            :meth:`get_request_token`.
        :type request_token_secret: str
        :param method: A string representation of the HTTP method to be
            used, defaults to `GET`.
        :type method: str
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        # ensure we've set the access_token_url
        if self.access_token_url is None:
            raise TypeError('access_token_url must not be None')

        session = self.get_session((request_token, request_token_secret))
        self.access_token_response = session.request(method,
                                                     self.access_token_url,
                                                     **kwargs)
        return self.access_token_response

    def get_access_token(self,
                         request_token,
                         request_token_secret,
                         method='GET',
                         decoder=parse_utf8_qsl,
                         key_token='oauth_token',
                         key_token_secret='oauth_token_secret',
                         **kwargs):
        '''
        Returns an access token pair.

        :param request_token: The request token as returned by
            :meth:`get_request_token`.
        :type request_token: str
        :param request_token_secret: The request token secret as returned by
            :meth:`get_request_token`.
        :type request_token_secret: str
        :param method: A string representation of the HTTP method to be
            used, defaults to `GET`.
        :type method: str
        :param decoder: A function used to parse the Response content. Should
            return a dictionary.
        :type decoder: func
        :param key_token: The key the access token will be decoded by, defaults
            to 'oauth_token'.
        :type string:
        :param key_token_secret: The key the access token will be decoded by,
            defaults to 'oauth_token_secret'.
        :type string:
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        r = self.get_raw_access_token(request_token,
                                      request_token_secret,
                                      method=method,
                                      **kwargs)

        access_token, access_token_secret = \
            process_token_request(r, decoder, key_token, key_token_secret)
        return access_token, access_token_secret

    def get_auth_session(self,
                         request_token,
                         request_token_secret,
                         method='GET',
                         **kwargs):
        '''
        Gets an access token, intializes a new authenticated session with the
        access token. Returns an instance of :attr:`session_obj`.

        :param request_token: The request token as returned by
            :meth:`get_request_token`.
        :type request_token: str
        :param request_token_secret: The request token secret as returned by
            :meth:`get_request_token`.
        :type request_token_secret: str
        :param method: A string representation of the HTTP method to be
            used, defaults to `GET`.
        :type method: str
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        token = self.get_access_token(request_token,
                                      request_token_secret,
                                      method=method,
                                      **kwargs)
        session = self.get_session(token)

        if self.request_token_response:
            session.request_token_response = self.request_token_response
        if self.access_token_response:
            session.access_token_response = self.access_token_response

        return session


class OAuth2Service(Service):
    '''
    An OAuth 2.0 Service container.

    This class provides a wrapper around a specialized Requests'
    :class:`~requests.session.Session` object. Primarily this wrapper is used
    for producing authenticated session objects which are used to make requests
    against OAuth 2.0 endpoints.

    You might intialize :class:`OAuth2Service` something like this::

        service = OAuth2Service(
                   name='example',
                   client_id='123',
                   client_secret='456',
                   access_token_url='https://example.com/token',
                   authorize_url='https://example.com/authorize',
                   base_url='https://example.com/api/')

    Given the simplicity of OAuth 2.0 now this object `service` can be used to
    retrieve an authenticated session in two simple steps::

        # the return URL is used to validate the request
        params = {'redirect_uri': 'http://example.com/',
                  'response_type': 'code'}
        url = service.get_authorize_url(**params)

        # once the above URL is consumed by a client we can ask for an access
        # token. note that the code is retrieved from the redirect URL above,
        # as set by the provider
        data = {'code': 'foobar',
                'grant_type': 'authorization_code',
                'redirect_uri': 'http://example.com/'}

        session = service.get_auth_session(data=data)

    Now that we have retrieved a session, we may make requests against the
    OAuth 2.0 provider's endpoints. As much as possible the Requests' API
    is preserved and you may make requests using the same parameters you would
    using Requests::

        r = session.get('foo', params={'format': 'json'})
        print r.json()

    :param client_id: Client id.
    :type client_id: str
    :param client_secret: Client secret.
    :type client_secret: str
    :param name: The service name, defaults to `None`.
    :type name: str
    :param access_token_url: Access token endpoint, defaults to `None`.
    :type access_token_url: str
    :param authorize_url: Authorize endpoint, defaults to `None`.
    :type authorize_url: str
    :param base_url: A base URL from which to construct requests, defaults to
        `None`.
    :type base_url: str
    :param session_obj: Object used to construct sessions with, defaults to
        :class:`OAuth2Session`
    :type session_obj: :class:`rauth.Session`
    '''
    __attrs__ = Service.__attrs__ + ['client_id',
                                     'client_secret',
                                     'access_token_url',
                                     'session_obj']

    def __init__(self,
                 client_id,
                 client_secret,
                 name=None,
                 access_token_url=None,
                 authorize_url=None,
                 base_url=None,
                 session_obj=None):

        #: Client credentials.
        self.client_id = client_id
        self.client_secret = client_secret

        #: The provider's access token URL.
        self.access_token_url = access_token_url

        #: Object used to construct sessions with.
        self.session_obj = session_obj or OAuth2Session

        #: Access token response.
        self.access_token_response = None

        super(OAuth2Service, self).__init__(name,
                                            base_url,
                                            authorize_url)

    def get_session(self, token=None):
        '''
        If provided, the `token` parameter is used to initialize an
        authenticated session, otherwise an unauthenticated session object is
        generated. Returns an instance of :attr:`session_obj`..

        :param token: A token with which to initilize the session.
        :type token: str
        '''
        if token is not None:
            session = self.session_obj(self.client_id,
                                       self.client_secret,
                                       token,
                                       service=self)
        else:  # pragma: no cover
            session = self.session_obj(self.client_id,
                                       self.client_secret,
                                       service=self)
        return session

    def get_authorize_url(self, **params):
        '''
        Returns a formatted authorize URL.

        :param \*\*params: Additional keyworded arguments to be added to the
            URL querystring.
        :type \*\*params: dict
        '''

        params.update({'client_id': self.client_id})
        return self.authorize_url + '?' + urlencode(params)

    def get_raw_access_token(self, method='POST', **kwargs):
        '''
        Returns a Requests' response over the
        :attr:`OAuth2Service.access_token_url`.

        Use this if your endpoint if you need the full `Response` object.

        :param method: A string representation of the HTTP method to be used,
            defaults to `POST`.
        :type method: str
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        key = 'params'
        if method in ENTITY_METHODS:
            key = 'data'

        kwargs.setdefault(key, {})
        kwargs[key].update({'client_id': self.client_id,
                            'client_secret': self.client_secret})

        session = self.get_session()
        self.access_token_response = session.request(method,
                                                     self.access_token_url,
                                                     **kwargs)
        return self.access_token_response

    def get_access_token(self,
                         method='POST',
                         decoder=parse_utf8_qsl,
                         key='access_token',
                         **kwargs):
        '''
        Returns an access token.

        :param method: A string representation of the HTTP method to be used,
            defaults to `POST`.
        :type method: str
        :param decoder: A function used to parse the Response content. Should
            return a dictionary.
        :type decoder: func
        :param key: The key the access token will be decoded by, defaults to
            'access_token'.
        :type string:
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        r = self.get_raw_access_token(method, **kwargs)
        access_token, = process_token_request(r, decoder, key)
        return access_token

    def get_auth_session(self, method='POST', **kwargs):
        '''
        Gets an access token, intializes a new authenticated session with the
        access token. Returns an instance of :attr:`session_obj`.

        :param method: A string representation of the HTTP method to be used,
            defaults to `POST`.
        :type method: str
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        session = self.get_session(self.get_access_token(method, **kwargs))

        if self.access_token_response:
            session.access_token_response = self.access_token_response

        return session


class OflyService(Service):
    '''
    An Ofly Service container.

    This class wraps an Ofly service i.e., Shutterfly. The process
    is similar to that of OAuth 1.0 but simplified.

    You might intialize :class:`OflyService` something like this::

        service = OflyService(name='example',
                              app_id='123',
                              app_secret='456',
                              authorize_url='http://example.com/authorize')

    A signed authorize URL is then produced via calling
    `service.get_authorize_url`. Once this has been visited by the client and
    assuming the client authorizes the request.

    Normal API calls can now be made using a session instance. Retrieve the
    authenticated session like so::

        session = service.get_auth_session('foo')

        # now we can make regular Requests' calls
        r = session.get('bar')

    :param app_id: The oFlyAppId, i.e. "application ID".
    :type app_id: str
    :param app_secret: The oFlyAppSecret, i.e. "shared secret".
    :type app_secret: str
    :param name: The service name, defaults to `None`.
    :type name: str
    :param authorize_url: Authorize endpoint, defaults to `None`.
    :type authorize_url: str
    :param base_url: A base URL from which to construct requests, defaults to
        `None`.
    :type base_url: str
    :param user_id: The oflyUserid, defaults to `None`. Note: this is required
        for Ofly requests, retrieved via authorize URL.
    :type user_id: str
    :param session_obj: Object used to construct sessions with, defaults to
        `rauth.OflySession`
    :type session_obj: :class:`rauth.Session`
    '''
    __attrs__ = Service.__attrs__ + ['app_id',
                                     'app_secret',
                                     'user_id',
                                     'session_obj']

    def __init__(self,
                 app_id,
                 app_secret,
                 name=None,
                 authorize_url=None,
                 base_url=None,
                 user_id=None,
                 session_obj=None):
        #: Client credentials.
        self.app_id = app_id
        self.app_secret = app_secret

        #: The oflyUserid.
        self.user_id = user_id

        #: Object used to construct sessions with.
        self.session_obj = session_obj or OflySession

        super(OflyService, self).__init__(name,
                                          base_url,
                                          authorize_url)

    def get_session(self, token):
        '''
        The token parameter should be `oFlyUserid`. This is used to initialize
        an authenticated session instance. Returns an instance of
        :attr:`session_obj`.

        :param token: A token with which to initialize the session with, e.g.
            :attr:`OflyService.user_id`.
        :type token: str
        '''
        return self.session_obj(self.app_id,
                                self.app_secret,
                                token,
                                service=self)

    def get_authorize_url(self, **params):
        '''
        Returns a formatted authorize URL.

        :param \*\*params: Additional keyworded arguments to be added to the
            request querystring.
        :type \*\*params: dict
        '''
        params = self.session_obj.sign(self.authorize_url,
                                       self.app_id,
                                       self.app_secret,
                                       **params)
        return self.authorize_url + '?' + params

    def get_auth_session(self, user_id, **kwargs):
        '''
        Intializes a new authenticated session with `user_id` as oFlyUserid.
        Returns an instance of :attr:`session_obj`.

        :param user_id: The oflyUserid, defaults to `None`.
        :type user_id: str
        :param \*\*kwargs: Optional arguments. Same as Requests.
        :type \*\*kwargs: dict
        '''
        return self.get_session(user_id)
