import hashlib

__all__ = [
    'BadRequestException',
    'BadStateException',
    'CsrfException',
    'DropboxOAuth2Flow',
    'DropboxOAuth2FlowNoRedirect',
    'NotApprovedException',
    'OAuth2FlowNoRedirectResult',
    'OAuth2FlowResult',
    'ProviderException',
]

import base64
import os
import six
import urllib
import re
from datetime import datetime, timedelta

from .session import (
    API_HOST,
    WEB_HOST,
    pinned_session,
    DEFAULT_TIMEOUT,
)

if six.PY3:
    url_path_quote = urllib.parse.quote  # pylint: disable=no-member,useless-suppression
    url_encode = urllib.parse.urlencode  # pylint: disable=no-member,useless-suppression
else:
    url_path_quote = urllib.quote  # pylint: disable=no-member,useless-suppression
    url_encode = urllib.urlencode  # pylint: disable=no-member,useless-suppression

TOKEN_ACCESS_TYPES = ['offline', 'online', 'legacy']
INCLUDE_GRANTED_SCOPES_TYPES = ['user', 'team']
PKCE_VERIFIER_LENGTH = 128

class OAuth2FlowNoRedirectResult(object):
    """
    Authorization information for an OAuth2Flow performed with no redirect.
    """

    def __init__(self, access_token, account_id, user_id, refresh_token, expiration, scope):
        """
        :param str access_token: Token to be used to authenticate later requests.
        :param str account_id: The Dropbox user's account ID.
        :param str user_id: Deprecated (use :attr:`account_id` instead).
        :param str refresh_token: Token to be used to acquire new access token when existing one
            expires.
        :param expiration: Either the number of seconds from now that the token expires in or the
            datetime at which the token expires.
        :type expiration: int or datetime
        :param list scope: List of scopes to request in base oauth flow.
        """
        self.access_token = access_token
        if not expiration:
            self.expires_at = None
        elif isinstance(expiration, datetime):
            self.expires_at = expiration
        else:
            self.expires_at = datetime.utcnow() + timedelta(seconds=int(expiration))
        self.refresh_token = refresh_token
        self.account_id = account_id
        self.user_id = user_id
        self.scope = scope

    def __repr__(self):
        return 'OAuth2FlowNoRedirectResult(%s, %s, %s, %s, %s, %s)' % (
            self.access_token,
            self.account_id,
            self.user_id,
            self.refresh_token,
            self.expires_at,
            self.scope,
        )


class OAuth2FlowResult(OAuth2FlowNoRedirectResult):
    """
    Authorization information for an :class:`OAuth2Flow` with redirect.
    """

    def __init__(self, access_token, account_id, user_id, url_state, refresh_token,
                 expires_in, scope):
        """
        Same as :class:`OAuth2FlowNoRedirectResult` but with url_state.

        :param str url_state: The url state that was set by :meth:`DropboxOAuth2Flow.start`.
        """
        super(OAuth2FlowResult, self).__init__(
            access_token=access_token,
            account_id=account_id,
            user_id=user_id,
            refresh_token=refresh_token,
            expiration=expires_in,
            scope=scope)
        self.url_state = url_state

    @classmethod
    def from_no_redirect_result(cls, result, url_state):
        assert isinstance(result, OAuth2FlowNoRedirectResult)
        return cls(result.access_token, result.account_id, result.user_id,
                   url_state, result.refresh_token, result.expires_at, result.scope)

    def __repr__(self):
        return 'OAuth2FlowResult(%s, %s, %s, %s, %s, %s, %s)' % (
            self.access_token,
            self.account_id,
            self.user_id,
            self.url_state,
            self.refresh_token,
            self.expires_at,
            self.scope,
        )


class DropboxOAuth2FlowBase(object):

    def __init__(self, consumer_key, consumer_secret=None, locale=None, token_access_type=None,
                 scope=None, include_granted_scopes=None, use_pkce=False, timeout=DEFAULT_TIMEOUT,
                 ca_certs=None):
        if scope is not None and (len(scope) == 0 or not isinstance(scope, list)):
            raise BadInputException("Scope list must be of type list")
        if token_access_type is not None and token_access_type not in TOKEN_ACCESS_TYPES:
            raise BadInputException("Token access type must be from the following enum: {}".format(
                TOKEN_ACCESS_TYPES))
        if not (use_pkce or consumer_secret):
            raise BadInputException("Must pass in either consumer secret or use PKCE")
        if include_granted_scopes and not scope:
            raise BadInputException("Must pass in scope to pass include_granted_scopes")

        self.consumer_key = consumer_key
        self.consumer_secret = consumer_secret
        self.locale = locale
        self.token_access_type = token_access_type
        self.requests_session = pinned_session(ca_certs=ca_certs)
        self.scope = scope
        self.include_granted_scopes = include_granted_scopes
        self._timeout = timeout

        if use_pkce:
            self.code_verifier = _generate_pkce_code_verifier()
            self.code_challenge = _generate_pkce_code_challenge(self.code_verifier)
        else:
            self.code_verifier = None
            self.code_challenge = None

    def _get_authorize_url(self, redirect_uri, state, token_access_type=None, scope=None,
                           include_granted_scopes=None, code_challenge=None):
        params = dict(response_type='code',
                      client_id=self.consumer_key)
        if redirect_uri is not None:
            params['redirect_uri'] = redirect_uri
        if state is not None:
            params['state'] = state
        if token_access_type is not None:
            assert token_access_type in TOKEN_ACCESS_TYPES
            params['token_access_type'] = token_access_type
        if code_challenge:
            params['code_challenge'] = code_challenge
            params['code_challenge_method'] = 'S256'

        if scope is not None:
            params['scope'] = " ".join(scope)
            if include_granted_scopes is not None:
                assert include_granted_scopes in INCLUDE_GRANTED_SCOPES_TYPES
                params['include_granted_scopes'] = include_granted_scopes

        return self.build_url('/oauth2/authorize', params, WEB_HOST)

    def _finish(self, code, redirect_uri, code_verifier):
        url = self.build_url('/oauth2/token')
        params = {'grant_type': 'authorization_code',
                  'code': code,
                  'client_id': self.consumer_key,
                  }
        if code_verifier:
            params['code_verifier'] = code_verifier
        else:
            params['client_secret'] = self.consumer_secret
        if self.locale is not None:
            params['locale'] = self.locale
        if redirect_uri is not None:
            params['redirect_uri'] = redirect_uri

        resp = self.requests_session.post(url, data=params, timeout=self._timeout)
        resp.raise_for_status()

        d = resp.json()

        if 'team_id' in d:
            account_id = d['team_id']
        else:
            account_id = d['account_id']

        access_token = d['access_token']

        if 'refresh_token' in d:
            refresh_token = d['refresh_token']
        else:
            refresh_token = ""

        if 'expires_in' in d:
            expires_in = d['expires_in']
        else:
            expires_in = None

        if 'scope' in d:
            scope = d['scope']
        else:
            scope = None

        uid = d['uid']

        return OAuth2FlowNoRedirectResult(
            access_token,
            account_id,
            uid,
            refresh_token,
            expires_in,
            scope)

    def build_path(self, target, params=None):
        """Build the path component for an API URL.

        This method urlencodes the parameters, adds them to the end of the target url, and puts a
        marker for the API version in front.

        :param str target: A target url (e.g. '/files') to build upon.
        :param dict params: Optional dictionary of parameters (name to value).
        :return: The path and parameters components of an API URL.
        :rtype: str
        """
        if six.PY2 and isinstance(target, six.text_type):
            target = target.encode('utf8')

        target_path = url_path_quote(target)

        params = params or {}
        params = params.copy()

        if self.locale:
            params['locale'] = self.locale

        if params:
            query_string = _params_to_urlencoded(params)
            return "%s?%s" % (target_path, query_string)
        else:
            return target_path

    def build_url(self, target, params=None, host=API_HOST):
        """Build an API URL.

        This method adds scheme and hostname to the path returned from build_path.

        :param str target: A target url (e.g. '/files') to build upon.
        :param dict params: Optional dictionary of parameters (name to value).
        :return: The full API URL.
        :rtype: str
        """
        return "https://%s%s" % (host, self.build_path(target, params))


class DropboxOAuth2FlowNoRedirect(DropboxOAuth2FlowBase):
    """
    OAuth 2 authorization helper for apps that can't provide a redirect URI
    (such as the command-line example apps).

    See examples under `example/oauth <https://github.com/dropbox/dropbox-sdk-python/tree/main/
    example/oauth>`_

    """

    def __init__(self, consumer_key, consumer_secret=None, locale=None, token_access_type=None,
                 scope=None, include_granted_scopes=None, use_pkce=False, timeout=DEFAULT_TIMEOUT,
                 ca_certs=None):  # noqa: E501;
        """
        Construct an instance.

        :param str consumer_key: Your API app's "app key".
        :param str consumer_secret: Your API app's "app secret".
        :param str locale: The locale of the user of your application.  For example "en" or "en_US".
            Some API calls return localized data and error messages; this setting tells the server
            which locale to use. By default, the server uses "en_US".
        :param str token_access_type: the type of token to be requested.
            From the following enum:

            * None - creates a token with the app default (either legacy or online)
            * legacy - creates one long-lived token with no expiration
            * online - create one short-lived token with an expiration
            * offline - create one short-lived token with an expiration with a refresh token

        :param list scope: list of scopes to request in base oauth flow.
            If left blank, will default to all scopes for app.
        :param str include_granted_scopes: which scopes to include from previous grants.
            From the following enum:

            * user - include user scopes in the grant
            * team - include team scopes in the grant
            * *Note*: if this user has never linked the app, include_granted_scopes must be None

        :param bool use_pkce: Whether or not to use Sha256 based PKCE. PKCE should be only use on
            client apps which doesn't call your server. It is less secure than non-PKCE flow but
            can be used if you are unable to safely retrieve your app secret.
        :param Optional[float] timeout: Maximum duration in seconds that
            client will wait for any single packet from the server. After the timeout the client
            will give up on connection. If `None`, client will wait forever. Defaults
            to 100 seconds.
        :param str ca_cert: path to CA certificate. If left blank, default certificate location \
            will be used
        """
        super(DropboxOAuth2FlowNoRedirect, self).__init__(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            locale=locale,
            token_access_type=token_access_type,
            scope=scope,
            include_granted_scopes=include_granted_scopes,
            use_pkce=use_pkce,
            timeout=timeout,
            ca_certs=ca_certs
        )

    def start(self):
        """
        Starts the OAuth 2 authorization process.

        :return: The URL for a page on Dropbox's website.  This page will let the user "approve"
            your app, which gives your app permission to access the user's Dropbox account.
            Tell the user to visit this URL and approve your app.
        """
        return self._get_authorize_url(None, None, self.token_access_type,
                                       scope=self.scope,
                                       include_granted_scopes=self.include_granted_scopes,
                                       code_challenge=self.code_challenge)

    def finish(self, code):
        """
        If the user approves your app, they will be presented with an "authorization code".
        Have the user copy/paste that authorization code into your app and then call this method to
        get an access token.

        :param str code: The authorization code shown to the user when they
            approved your app.
        :rtype: :class:`OAuth2FlowNoRedirectResult`
        :raises: The same exceptions as :meth:`DropboxOAuth2Flow.finish()`.
        """
        return self._finish(code, None, self.code_verifier)


class DropboxOAuth2Flow(DropboxOAuth2FlowBase):
    """
    OAuth 2 authorization helper. Use this for web apps.

    OAuth 2 has a two-step authorization process. The first step is having the user authorize your
    app. The second involves getting an OAuth 2 access token from Dropbox.

    See examples under `example/oauth <https://github.com/dropbox/dropbox-sdk-python/tree/main/
    example/oauth>`_

    """

    def __init__(self, consumer_key, redirect_uri, session,
                 csrf_token_session_key, consumer_secret=None, locale=None,
                 token_access_type=None, scope=None,
                 include_granted_scopes=None, use_pkce=False, timeout=DEFAULT_TIMEOUT,
                 ca_certs=None):
        """
        Construct an instance.

        :param str consumer_key: Your API app's "app key".
        :param str redirect_uri: The URI that the Dropbox server will redirect the user to after the
            user finishes authorizing your app.  This URI must be HTTPS-based and pre-registered
            with the Dropbox servers, though localhost URIs are allowed without pre-registration and
            can be either HTTP or HTTPS.
        :param dict session: A dict-like object that represents the current user's web session
            (Will be used to save the CSRF token).
        :param str csrf_token_session_key: The key to use when storing the CSRF token in the session
            (For example: "dropbox-auth-csrf-token").
        :param str consumer_secret: Your API app's "app secret".
        :param str locale: The locale of the user of your application. For example "en" or "en_US".
            Some API calls return localized data and error messages; this setting tells the server
            which locale to use. By default, the server uses "en_US".
        :param str token_access_type: The type of token to be requested.
            From the following enum:

            * None - creates a token with the app default (either legacy or online)
            * legacy - creates one long-lived token with no expiration
            * online - create one short-lived token with an expiration
            * offline - create one short-lived token with an expiration with a refresh token

        :param list scope: List of scopes to request in base oauth flow.  If left blank,
            will default to all scopes for app.
        :param str include_granted_scopes: Which scopes to include from previous grants.
            From the following enum:

            * user - include user scopes in the grant
            * team - include team scopes in the grant
            * *Note*: If this user has never linked the app, :attr:`include_granted_scopes` must \
            be `None`

        :param bool use_pkce: Whether or not to use Sha256 based PKCE
        :param Optional[float] timeout: Maximum duration in seconds that client will wait for any
            single packet from the server. After the timeout the client will give up on connection.
            If `None`, client will wait forever. Defaults to 100 seconds.
        :param str ca_cert: path to CA certificate. If left blank, default certificate location \
            will be used
        """

        super(DropboxOAuth2Flow, self).__init__(
            consumer_key=consumer_key,
            consumer_secret=consumer_secret,
            locale=locale,
            token_access_type=token_access_type,
            scope=scope,
            include_granted_scopes=include_granted_scopes,
            use_pkce=use_pkce,
            timeout=timeout,
            ca_certs=ca_certs
        )
        self.redirect_uri = redirect_uri
        self.session = session
        self.csrf_token_session_key = csrf_token_session_key

    def start(self, url_state=None):
        """
        Starts the OAuth 2 authorization process.

        This function builds an "authorization URL". You should redirect your user's browser to this
            URL, which will give them an opportunity to grant your app access to their Dropbox
            account. When the user completes this process, they will be automatically redirected to
            the :attr:`redirect_uri` you passed in to the constructor. This function will also save
            a CSRF token to :attr:`session[csrf_token_session_key]`
            (as provided to the constructor). This CSRF token will be checked on :meth:`finish()`
            to prevent request forgery.

        :param str url_state: Any data that you would like to keep in the URL through the
            authorization process. This exact value will be returned to you by :meth:`finish()`.
        :return: The URL for a page on Dropbox's website. This page will let the user "approve" your
            app, which gives your app permission to access the user's Dropbox account. Tell the user
            to visit this URL and approve your app.
        """
        csrf_token = base64.urlsafe_b64encode(os.urandom(16)).decode('ascii')
        state = csrf_token
        if url_state is not None:
            state += "|" + url_state
        self.session[self.csrf_token_session_key] = csrf_token

        return self._get_authorize_url(self.redirect_uri, state, self.token_access_type,
                                       scope=self.scope,
                                       include_granted_scopes=self.include_granted_scopes,
                                       code_challenge=self.code_challenge)

    def finish(self, query_params):
        """
        Call this after the user has visited the authorize URL (see :meth:`start()`), approved your
        app and was redirected to your redirect URI.

        :param dict query_params: The query parameters on the GET request to your redirect URI.
        :rtype: class:`OAuth2FlowResult`
        :raises: :class:`BadRequestException` If the redirect URL was missing parameters or if the
            given parameters were not valid.
        :raises: :class:`BadStateException` If there's no CSRF token in the session.
        :raises: :class:`CsrfException` If the :attr:`state` query parameter doesn't contain the
            CSRF token from the user's session.
        :raises: :class:`NotApprovedException` If the user chose not to approve your app.
        :raises: :class:`ProviderException` If Dropbox redirected to your redirect URI with some
            unexpected error identifier and error message.
        """
        # Check well-formedness of request.

        state = query_params.get('state')
        if state is None:
            raise BadRequestException("Missing query parameter 'state'.")

        error = query_params.get('error')
        error_description = query_params.get('error_description')
        code = query_params.get('code')

        if error is not None and code is not None:
            raise BadRequestException(
                "Query parameters 'code' and 'error' are both set; "
                "only one must be set.")
        if error is None and code is None:
            raise BadRequestException(
                "Neither query parameter 'code' or 'error' is set.")

        # Check CSRF token

        if self.csrf_token_session_key not in self.session:
            raise BadStateException('Missing CSRF token in session.')
        csrf_token_from_session = self.session[self.csrf_token_session_key]
        if len(csrf_token_from_session) <= 20:
            raise AssertionError('CSRF token unexpectedly short: %r' %
                                 csrf_token_from_session)

        split_pos = state.find('|')
        if split_pos < 0:
            given_csrf_token = state
            url_state = None
        else:
            given_csrf_token = state[0:split_pos]
            url_state = state[split_pos + 1:]

        if not _safe_equals(csrf_token_from_session, given_csrf_token):
            raise CsrfException('expected %r, got %r' %
                                (csrf_token_from_session, given_csrf_token))

        del self.session[self.csrf_token_session_key]

        # Check for error identifier

        if error is not None:
            if error == 'access_denied':
                # The user clicked "Deny"
                if error_description is None:
                    raise NotApprovedException(
                        'No additional description from Dropbox')
                else:
                    raise NotApprovedException(
                        'Additional description from Dropbox: %s' %
                        error_description)
            else:
                # All other errors
                full_message = error
                if error_description is not None:
                    full_message += ": " + error_description
                raise ProviderException(full_message)

        # If everything went ok, make the network call to get an access token.

        no_redirect_result = self._finish(code, self.redirect_uri, self.code_verifier)
        return OAuth2FlowResult.from_no_redirect_result(
            no_redirect_result, url_state)


class BadRequestException(Exception):
    """
    Thrown if the redirect URL was missing parameters or if the given parameters were not valid.

    The recommended action is to show an HTTP 400 error page.
    """
    pass


class BadStateException(Exception):
    """
    Thrown if all the parameters are correct, but there's no CSRF token in the session. This
    probably means that the session expired.

    The recommended action is to redirect the user's browser to try the approval process again.
    """
    pass


class CsrfException(Exception):
    """
    Thrown if the given 'state' parameter doesn't contain the CSRF token from the user's session.
    This is blocked to prevent CSRF attacks.

    The recommended action is to respond with an HTTP 403 error page.
    """
    pass


class NotApprovedException(Exception):
    """
    The user chose not to approve your app.
    """
    pass


class ProviderException(Exception):
    """
    Dropbox redirected to your redirect URI with some unexpected error identifier and error message.

    The recommended action is to log the error, tell the user something went wrong, and let them try
    again.
    """
    pass


class BadInputException(Exception):
    """
    Thrown if incorrect types/values are used

    This should only ever be thrown during testing, app should have validation of input prior to
    reaching this point
    """
    pass


def _safe_equals(a, b):
    if len(a) != len(b):
        return False
    res = 0
    for ca, cb in zip(a, b):
        res |= ord(ca) ^ ord(cb)
    return res == 0


def _params_to_urlencoded(params):
    """
    Returns a application/x-www-form-urlencoded :class:`str` representing the key/value pairs in
    :attr:`params`.

    Keys are values are ``str()``'d before calling :meth:`urllib.urlencode`, with the exception of
    unicode objects which are utf8-encoded.
    """
    def encode(o):
        if isinstance(o, six.binary_type):
            return o
        else:
            if isinstance(o, six.text_type):
                return o.encode('utf-8')
            else:
                return str(o).encode('utf-8')

    utf8_params = {encode(k): encode(v) for k, v in six.iteritems(params)}
    return url_encode(utf8_params)

def _generate_pkce_code_verifier():
    code_verifier = base64.urlsafe_b64encode(os.urandom(PKCE_VERIFIER_LENGTH)).decode('utf-8')
    code_verifier = re.sub('[^a-zA-Z0-9]+', '', code_verifier)
    if len(code_verifier) > PKCE_VERIFIER_LENGTH:
        code_verifier = code_verifier[:128]
    return code_verifier

def _generate_pkce_code_challenge(code_verifier):
    code_challenge = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    code_challenge = base64.urlsafe_b64encode(code_challenge).decode('utf-8')
    code_challenge = code_challenge.replace('=', '')
    return code_challenge
