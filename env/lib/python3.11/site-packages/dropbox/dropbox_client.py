__all__ = [
    'Dropbox',
    'DropboxTeam',
    'create_session',
]

# This should always be 0.0.0 in main. Only update this after tagging
# before release.
__version__ = '11.36.2'

import base64
import contextlib
import json
import logging
import random
import time

import requests
import six

from datetime import datetime, timedelta
from dropbox.auth import (
    AuthError_validator,
    RateLimitError_validator,
)
from dropbox import files
from dropbox.common import (
    PathRoot,
    PathRoot_validator,
    PathRootError_validator
)
from dropbox.base import DropboxBase
from dropbox.base_team import DropboxTeamBase
from dropbox.exceptions import (
    ApiError,
    AuthError,
    BadInputError,
    HttpError,
    PathRootError,
    InternalServerError,
    RateLimitError,
)
from dropbox.session import (
    API_HOST,
    API_CONTENT_HOST,
    API_NOTIFICATION_HOST,
    HOST_API,
    HOST_CONTENT,
    HOST_NOTIFY,
    pinned_session,
    DEFAULT_TIMEOUT
)
from stone.backends.python_rsrc import stone_serializers

PATH_ROOT_HEADER = 'Dropbox-API-Path-Root'
HTTP_STATUS_INVALID_PATH_ROOT = 422
TOKEN_EXPIRATION_BUFFER = 300

SELECT_ADMIN_HEADER = 'Dropbox-API-Select-Admin'

SELECT_USER_HEADER = 'Dropbox-API-Select-User'

USER_AUTH = 'user'
TEAM_AUTH = 'team'
APP_AUTH = 'app'
NO_AUTH = 'noauth'

class RouteResult(object):
    """The successful result of a call to a route."""

    def __init__(self, obj_result, http_resp=None):
        """
        :param str obj_result: The result of a route not including the binary
            payload portion, if one exists. Must be serialized JSON.
        :param requests.models.Response http_resp: A raw HTTP response. It will
            be used to stream the binary-body payload of the response.
        """
        assert isinstance(obj_result, six.string_types), \
            'obj_result: expected string, got %r' % type(obj_result)
        if http_resp is not None:
            assert isinstance(http_resp, requests.models.Response), \
                'http_resp: expected requests.models.Response, got %r' % \
                type(http_resp)
        self.obj_result = obj_result
        self.http_resp = http_resp

class RouteErrorResult(object):
    """The error result of a call to a route."""

    def __init__(self, request_id, obj_result):
        """
        :param str request_id: A request_id can be shared with Dropbox Support
            to pinpoint the exact request that returns an error.
        :param str obj_result: The result of a route not including the binary
            payload portion, if one exists.
        """
        self.request_id = request_id
        self.obj_result = obj_result

def create_session(max_connections=8, proxies=None, ca_certs=None):
    """
    Creates a session object that can be used by multiple :class:`Dropbox` and
    :class:`DropboxTeam` instances. This lets you share a connection pool
    amongst them, as well as proxy parameters.

    :param int max_connections: Maximum connection pool size.
    :param dict proxies: See the `requests module
            <http://docs.python-requests.org/en/latest/user/advanced/#proxies>`_
            for more details.
    :rtype: :class:`requests.sessions.Session`. `See the requests module
        <http://docs.python-requests.org/en/latest/user/advanced/#session-objects>`_
        for more details.
    """
    # We only need as many pool_connections as we have unique hostnames.
    session = pinned_session(pool_maxsize=max_connections, ca_certs=ca_certs)
    if proxies:
        session.proxies = proxies
    return session

class _DropboxTransport(object):
    """
    Responsible for implementing the wire protocol for making requests to the
    Dropbox API.
    """

    _API_VERSION = '2'

    # Download style means that the route argument goes in a Dropbox-API-Arg
    # header, and the result comes back in a Dropbox-API-Result header. The
    # HTTP response body contains a binary payload.
    _ROUTE_STYLE_DOWNLOAD = 'download'

    # Upload style means that the route argument goes in a Dropbox-API-Arg
    # header. The HTTP request body contains a binary payload. The result
    # comes back in a Dropbox-API-Result header.
    _ROUTE_STYLE_UPLOAD = 'upload'

    # RPC style means that the argument and result of a route are contained in
    # the HTTP body.
    _ROUTE_STYLE_RPC = 'rpc'

    def __init__(self,
                 oauth2_access_token=None,
                 max_retries_on_error=4,
                 max_retries_on_rate_limit=None,
                 user_agent=None,
                 session=None,
                 headers=None,
                 timeout=DEFAULT_TIMEOUT,
                 oauth2_refresh_token=None,
                 oauth2_access_token_expiration=None,
                 app_key=None,
                 app_secret=None,
                 scope=None,
                 ca_certs=None):
        """
        :param str oauth2_access_token: OAuth2 access token for making client
            requests.
        :param int max_retries_on_error: On 5xx errors, the number of times to
            retry.
        :param Optional[int] max_retries_on_rate_limit: On 429 errors, the
            number of times to retry. If `None`, always retries.
        :param str user_agent: The user agent to use when making requests. This
            helps us identify requests coming from your application. We
            recommend you use the format "AppName/Version". If set, we append
            "/OfficialDropboxPythonSDKv2/__version__" to the user_agent,
        :param session: If not provided, a new session (connection pool) is
            created. To share a session across multiple clients, use
            :func:`create_session`.
        :type session: :class:`requests.sessions.Session`
        :param dict headers: Additional headers to add to requests.
        :param Optional[float] timeout: Maximum duration in seconds that
            client will wait for any single packet from the
            server. After the timeout the client will give up on
            connection. If `None`, client will wait forever. Defaults
            to 100 seconds.
        :param str oauth2_refresh_token: OAuth2 refresh token for refreshing access token
        :param datetime oauth2_access_token_expiration: Expiration for oauth2_access_token
        :param str app_key: application key of requesting application; used for token refresh
        :param str app_secret: application secret of requesting application; used for token refresh
            Not required if PKCE was used to authorize the token
        :param list scope: list of scopes to request on refresh.  If left blank,
            refresh will request all available scopes for application
        :param str ca_certs: path to CA certificate. If left blank, default certificate location \
            will be used
        """

        if not (oauth2_access_token or oauth2_refresh_token or (app_key and app_secret)):
            raise BadInputException(
                'OAuth2 access token or refresh token or app key/secret must be set'
            )

        if headers is not None and not isinstance(headers, dict):
            raise BadInputException('Expected dict, got {}'.format(headers))

        if oauth2_refresh_token and not app_key:
            raise BadInputException("app_key is required to refresh tokens")

        if scope is not None and (len(scope) == 0 or not isinstance(scope, list)):
            raise BadInputException("Scope list must be of type list")

        self._oauth2_access_token = oauth2_access_token
        self._oauth2_refresh_token = oauth2_refresh_token
        self._oauth2_access_token_expiration = oauth2_access_token_expiration

        self._app_key = app_key
        self._app_secret = app_secret
        self._scope = scope

        self._max_retries_on_error = max_retries_on_error
        self._max_retries_on_rate_limit = max_retries_on_rate_limit
        if session:
            if not isinstance(session, requests.sessions.Session):
                raise BadInputException('Expected requests.sessions.Session, got {}'
                                        .format(session))
            self._session = session
        else:
            self._session = create_session(ca_certs=ca_certs)
        self._headers = headers

        base_user_agent = 'OfficialDropboxPythonSDKv2/' + __version__
        if user_agent:
            self._raw_user_agent = user_agent
            self._user_agent = '{}/{}'.format(user_agent, base_user_agent)
        else:
            self._raw_user_agent = None
            self._user_agent = base_user_agent

        self._logger = logging.getLogger('dropbox')

        self._host_map = {HOST_API: API_HOST,
                          HOST_CONTENT: API_CONTENT_HOST,
                          HOST_NOTIFY: API_NOTIFICATION_HOST}

        self._timeout = timeout

    def clone(
            self,
            oauth2_access_token=None,
            max_retries_on_error=None,
            max_retries_on_rate_limit=None,
            user_agent=None,
            session=None,
            headers=None,
            timeout=None,
            oauth2_refresh_token=None,
            oauth2_access_token_expiration=None,
            app_key=None,
            app_secret=None,
            scope=None):
        """
        Creates a new copy of the Dropbox client with the same defaults unless modified by
        arguments to clone()

        See constructor for original parameter descriptions.

        :return: New instance of Dropbox client
        :rtype: Dropbox
        """

        return self.__class__(
            oauth2_access_token or self._oauth2_access_token,
            max_retries_on_error or self._max_retries_on_error,
            max_retries_on_rate_limit or self._max_retries_on_rate_limit,
            user_agent or self._user_agent,
            session or self._session,
            headers or self._headers,
            timeout or self._timeout,
            oauth2_refresh_token or self._oauth2_refresh_token,
            oauth2_access_token_expiration or self._oauth2_access_token_expiration,
            app_key or self._app_key,
            app_secret or self._app_secret,
            scope or self._scope
        )

    def request(self,
                route,
                namespace,
                request_arg,
                request_binary,
                timeout=None):
        """
        Makes a request to the Dropbox API and in the process validates that
        the route argument and result are the expected data types. The
        request_arg is converted to JSON based on the arg_data_type. Likewise,
        the response is deserialized from JSON and converted to an object based
        on the {result,error}_data_type.

        :param host: The Dropbox API host to connect to.
        :param route: The route to make the request to.
        :type route: :class:`stone.backends.python_rsrc.stone_base.Route`
        :param request_arg: Argument for the route that conforms to the
            validator specified by route.arg_type.
        :param request_binary: String or file pointer representing the binary
            payload. Use None if there is no binary payload.
        :param Optional[float] timeout: Maximum duration in seconds
            that client will wait for any single packet from the
            server. After the timeout the client will give up on
            connection. If `None`, will use default timeout set on
            Dropbox object.  Defaults to `None`.
        :return: The route's result.
        """

        self.check_and_refresh_access_token()

        host = route.attrs['host'] or 'api'
        auth_type = route.attrs['auth']
        route_name = namespace + '/' + route.name
        if route.version > 1:
            route_name += '_v{}'.format(route.version)
        route_style = route.attrs['style'] or 'rpc'
        serialized_arg = stone_serializers.json_encode(route.arg_type,
                                                       request_arg)

        if (timeout is None and
                route == files.list_folder_longpoll):
            # The client normally sends a timeout value to the
            # longpoll route. The server will respond after
            # <timeout> + random(0, 90) seconds. We increase the
            # socket timeout to the longpoll timeout value plus 90
            # seconds so that we don't cut the server response short
            # due to a shorter socket timeout.
            # NB: This is done here because base.py is auto-generated
            timeout = request_arg.timeout + 90

        res = self.request_json_string_with_retry(host,
                                                  route_name,
                                                  route_style,
                                                  serialized_arg,
                                                  auth_type,
                                                  request_binary,
                                                  timeout=timeout)
        decoded_obj_result = json.loads(res.obj_result)
        if isinstance(res, RouteResult):
            returned_data_type = route.result_type
            obj = decoded_obj_result
        elif isinstance(res, RouteErrorResult):
            returned_data_type = route.error_type
            obj = decoded_obj_result['error']
            user_message = decoded_obj_result.get('user_message')
            user_message_text = user_message and user_message.get('text')
            user_message_locale = user_message and user_message.get('locale')
        else:
            raise AssertionError('Expected RouteResult or RouteErrorResult, '
                                 'but res is %s' % type(res))

        deserialized_result = stone_serializers.json_compat_obj_decode(
            returned_data_type, obj, strict=False)

        if isinstance(res, RouteErrorResult):
            raise ApiError(res.request_id,
                           deserialized_result,
                           user_message_text,
                           user_message_locale)
        elif route_style == self._ROUTE_STYLE_DOWNLOAD:
            return (deserialized_result, res.http_resp)
        else:
            return deserialized_result

    def check_and_refresh_access_token(self):
        """
        Checks if access token needs to be refreshed and refreshes if possible
        :return:
        """
        can_refresh = self._oauth2_refresh_token and self._app_key
        needs_refresh = self._oauth2_refresh_token and \
            (not self._oauth2_access_token_expiration or
            (datetime.utcnow() + timedelta(seconds=TOKEN_EXPIRATION_BUFFER)) >=
            self._oauth2_access_token_expiration)
        needs_token = not self._oauth2_access_token
        if (needs_refresh or needs_token) and can_refresh:
            self.refresh_access_token(scope=self._scope)

    def refresh_access_token(self, host=API_HOST, scope=None):
        """
        Refreshes an access token via refresh token if available

        :param host: host to hit token endpoint with
        :param scope: list of permission scopes for access token
        :return:
        """
        if scope is not None and (len(scope) == 0 or not isinstance(scope, list)):
            raise BadInputException("Scope list must be of type list")

        if not (self._oauth2_refresh_token and self._app_key):
            self._logger.warning('Unable to refresh access token without \
                refresh token and app key')
            return

        self._logger.info('Refreshing access token.')
        url = "https://{}/oauth2/token".format(host)
        body = {'grant_type': 'refresh_token',
                'refresh_token': self._oauth2_refresh_token,
                'client_id': self._app_key,
                }
        if self._app_secret:
            body['client_secret'] = self._app_secret
        if scope:
            scope = " ".join(scope)
            body['scope'] = scope

        timeout = DEFAULT_TIMEOUT
        if self._timeout:
            timeout = self._timeout
        res = self._session.post(url, data=body, timeout=timeout)
        self.raise_dropbox_error_for_resp(res)

        token_content = res.json()
        self._oauth2_access_token = token_content["access_token"]
        self._oauth2_access_token_expiration = datetime.utcnow() + \
            timedelta(seconds=int(token_content["expires_in"]))

    def request_json_object(self,
                            host,
                            route_name,
                            route_style,
                            request_arg,
                            auth_type,
                            request_binary,
                            timeout=None):
        """
        Makes a request to the Dropbox API, taking a JSON-serializable Python
        object as an argument, and returning one as a response.

        :param host: The Dropbox API host to connect to.
        :param route_name: The name of the route to invoke.
        :param route_style: The style of the route.
        :param str request_arg: A JSON-serializable Python object representing
            the argument for the route.
        :param auth_type str
        :param Optional[bytes] request_binary: Bytes representing the binary
            payload. Use None if there is no binary payload.
        :param Optional[float] timeout: Maximum duration in seconds
            that client will wait for any single packet from the
            server. After the timeout the client will give up on
            connection. If `None`, will use default timeout set on
            Dropbox object.  Defaults to `None`.
        :return: The route's result as a JSON-serializable Python object.
        """
        serialized_arg = json.dumps(request_arg)
        res = self.request_json_string_with_retry(host,
                                                  route_name,
                                                  route_style,
                                                  serialized_arg,
                                                  auth_type,
                                                  request_binary,
                                                  timeout=timeout)
        # This can throw a ValueError if the result is not deserializable,
        # but that would be completely unexpected.
        deserialized_result = json.loads(res.obj_result)
        if isinstance(res, RouteResult) and res.http_resp is not None:
            return (deserialized_result, res.http_resp)
        else:
            return deserialized_result

    def request_json_string_with_retry(self,
                                       host,
                                       route_name,
                                       route_style,
                                       request_json_arg,
                                       auth_type,
                                       request_binary,
                                       timeout=None):
        """
        See :meth:`request_json_object` for description of parameters.

        :param request_json_arg: A string representing the serialized JSON
            argument to the route.
        """
        attempt = 0
        rate_limit_errors = 0
        has_refreshed = False
        while True:
            self._logger.info('Request to %s', route_name)
            try:
                return self.request_json_string(host,
                                                route_name,
                                                route_style,
                                                request_json_arg,
                                                auth_type,
                                                request_binary,
                                                timeout=timeout)
            except AuthError as e:
                if e.error and e.error.is_expired_access_token():
                    if has_refreshed:
                        raise
                    else:
                        self._logger.info(
                            'ExpiredCredentials status_code=%s: Refreshing and Retrying',
                            e.status_code)
                        self.refresh_access_token()
                        has_refreshed = True
                else:
                    raise
            except InternalServerError as e:
                attempt += 1
                if attempt <= self._max_retries_on_error:
                    # Use exponential backoff
                    backoff = 2**attempt * random.random()
                    self._logger.info(
                        'HttpError status_code=%s: Retrying in %.1f seconds',
                        e.status_code, backoff)
                    time.sleep(backoff)
                else:
                    raise
            except RateLimitError as e:
                rate_limit_errors += 1
                if (self._max_retries_on_rate_limit is None or
                        self._max_retries_on_rate_limit >= rate_limit_errors):
                    # Set default backoff to 5 seconds.
                    backoff = e.backoff if e.backoff is not None else 5.0
                    self._logger.info(
                        'Ratelimit: Retrying in %.1f seconds.', backoff)
                    time.sleep(backoff)
                else:
                    raise

    def request_json_string(self,
                            host,
                            func_name,
                            route_style,
                            request_json_arg,
                            auth_type,
                            request_binary,
                            timeout=None):
        """
        See :meth:`request_json_string_with_retry` for description of
        parameters.
        """
        if host not in self._host_map:
            raise ValueError('Unknown value for host: %r' % host)

        if not isinstance(request_binary, (six.binary_type, type(None))):
            # Disallow streams and file-like objects even though the underlying
            # requests library supports them. This is to prevent incorrect
            # behavior when a non-rewindable stream is read from, but the
            # request fails and needs to be re-tried at a later time.
            raise TypeError('expected request_binary as binary type, got %s' %
                            type(request_binary))

        # Fully qualified hostname
        fq_hostname = self._host_map[host]
        url = self._get_route_url(fq_hostname, func_name)

        headers = {'User-Agent': self._user_agent}
        auth_types = auth_type.replace(' ', '').split(',')
        if (USER_AUTH in auth_types or TEAM_AUTH in auth_types) and self._oauth2_access_token:
            headers['Authorization'] = 'Bearer %s' % self._oauth2_access_token
            if self._headers:
                headers.update(self._headers)
        elif APP_AUTH in auth_types:
            if self._app_key is None or self._app_secret is None:
                raise BadInputException(
                    'Client id and client secret are required for routes with app auth')
            auth_header = base64.b64encode(
                "{}:{}".format(self._app_key, self._app_secret).encode("utf-8")
            )
            headers['Authorization'] = 'Basic {}'.format(auth_header.decode("utf-8"))
            if self._headers:
                headers.update(self._headers)
        elif auth_type == NO_AUTH:
            pass
        else:
            raise BadInputException('Unhandled auth type: {}'.format(auth_type))

        # The contents of the body of the HTTP request
        body = None
        # Whether the response should be streamed incrementally, or buffered
        # entirely. If stream is True, the caller is responsible for closing
        # the HTTP response.
        stream = False

        if route_style == self._ROUTE_STYLE_RPC:
            headers['Content-Type'] = 'application/json'
            body = request_json_arg
        elif route_style == self._ROUTE_STYLE_DOWNLOAD:
            headers['Dropbox-API-Arg'] = request_json_arg
            stream = True
        elif route_style == self._ROUTE_STYLE_UPLOAD:
            headers['Content-Type'] = 'application/octet-stream'
            headers['Dropbox-API-Arg'] = request_json_arg
            body = request_binary
        else:
            raise ValueError('Unknown operation style: %r' % route_style)

        if timeout is None:
            timeout = self._timeout

        r = self._session.post(url,
                               headers=headers,
                               data=body,
                               stream=stream,
                               verify=True,
                               timeout=timeout,
                               )
        self.raise_dropbox_error_for_resp(r)
        request_id = r.headers.get('x-dropbox-request-id')
        if r.status_code in (403, 404, 409):
            raw_resp = r.content.decode('utf-8')
            return RouteErrorResult(request_id, raw_resp)

        if route_style == self._ROUTE_STYLE_DOWNLOAD:
            raw_resp = r.headers['dropbox-api-result']
        else:
            assert r.headers.get('content-type') == 'application/json', (
                'Expected content-type to be application/json, got %r' %
                r.headers.get('content-type'))
            raw_resp = r.content.decode('utf-8')
        if route_style == self._ROUTE_STYLE_DOWNLOAD:
            return RouteResult(raw_resp, r)
        else:
            return RouteResult(raw_resp)

    def raise_dropbox_error_for_resp(self, res):
        """Checks for errors from a res and handles appropiately.

        :param res: Response of an api request.
        """
        request_id = res.headers.get('x-dropbox-request-id')
        if res.status_code >= 500:
            raise InternalServerError(request_id, res.status_code, res.text)
        elif res.status_code == 400:
            try:
                if res.json()['error'] == 'invalid_grant':
                    request_id = res.headers.get('x-dropbox-request-id')
                    err = stone_serializers.json_compat_obj_decode(
                        AuthError_validator, 'invalid_access_token')
                    raise AuthError(request_id, err)
                else:
                    raise BadInputError(request_id, res.text)
            except ValueError:
                raise BadInputError(request_id, res.text)
        elif res.status_code == 401:
            assert res.headers.get('content-type') == 'application/json', (
                'Expected content-type to be application/json, got %r' %
                res.headers.get('content-type'))
            err = stone_serializers.json_compat_obj_decode(
                AuthError_validator, res.json()['error'])
            raise AuthError(request_id, err)
        elif res.status_code == HTTP_STATUS_INVALID_PATH_ROOT:
            err = stone_serializers.json_compat_obj_decode(
                PathRootError_validator, res.json()['error'])
            raise PathRootError(request_id, err)
        elif res.status_code == 429:
            err = None
            if res.headers.get('content-type') == 'application/json':
                err = stone_serializers.json_compat_obj_decode(
                    RateLimitError_validator, res.json()['error'])
                retry_after = err.retry_after
            else:
                retry_after_str = res.headers.get('retry-after')
                if retry_after_str is not None:
                    retry_after = int(retry_after_str)
                else:
                    retry_after = None
            raise RateLimitError(request_id, err, retry_after)
        elif res.status_code in (403, 404, 409):
            # special case handled by requester
            return
        elif not (200 <= res.status_code <= 299):
            raise HttpError(request_id, res.status_code, res.text)

    def _get_route_url(self, hostname, route_name):
        """Returns the URL of the route.

        :param str hostname: Hostname to make the request to.
        :param str route_name: Name of the route.
        :rtype: str
        """
        return 'https://{hostname}/{version}/{route_name}'.format(
            hostname=hostname,
            version=Dropbox._API_VERSION,
            route_name=route_name,
        )

    def _save_body_to_file(self, download_path, http_resp, chunksize=2**16):
        """
        Saves the body of an HTTP response to a file.

        :param str download_path: Local path to save data to.
        :param http_resp: The HTTP response whose body will be saved.
        :type http_resp: :class:`requests.models.Response`
        :rtype: None
        """
        with open(download_path, 'wb') as f:
            with contextlib.closing(http_resp):
                for c in http_resp.iter_content(chunksize):
                    f.write(c)

    def with_path_root(self, path_root):
        """
        Creates a clone of the Dropbox instance with the Dropbox-API-Path-Root header
        as the appropriate serialized instance of PathRoot.

        For more information, see
        https://www.dropbox.com/developers/reference/namespace-guide#pathrootmodes

        :param PathRoot path_root: instance of PathRoot to serialize into the headers field
        :return: A :class: `Dropbox`
        :rtype: Dropbox
        """

        if not isinstance(path_root, PathRoot):
            raise ValueError("path_root must be an instance of PathRoot")

        new_headers = self._headers.copy() if self._headers else {}
        new_headers[PATH_ROOT_HEADER] = stone_serializers.json_encode(PathRoot_validator, path_root)

        return self.clone(
            headers=new_headers
        )

    def close(self):
        """
        Cleans up all resources like the request session/network connection.
        """
        self._session.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class Dropbox(_DropboxTransport, DropboxBase):
    """
    Use this class to make requests to the Dropbox API using a user's access
    token. Methods of this class are meant to act on the corresponding user's
    Dropbox.
    """
    pass

class DropboxTeam(_DropboxTransport, DropboxTeamBase):
    """
    Use this class to make requests to the Dropbox API using a team's access
    token. Methods of this class are meant to act on the team, but there is
    also an :meth:`as_user` method for assuming a team member's identity.
    """
    def as_admin(self, team_member_id):
        """
        Allows a team credential to assume the identity of an administrator on the team
        and perform operations on any team-owned content.

        :param str team_member_id: team member id of administrator to perform actions with
        :return: A :class:`Dropbox` object that can be used to query on behalf
            of this admin of the team.
        :rtype: Dropbox
        """
        return self._get_dropbox_client_with_select_header(SELECT_ADMIN_HEADER,
                                                           team_member_id)

    def as_user(self, team_member_id):
        """
        Allows a team credential to assume the identity of a member of the
        team.

        :param str team_member_id: team member id of team member to perform actions with
        :return: A :class:`Dropbox` object that can be used to query on behalf
            of this member of the team.
        :rtype: Dropbox
        """
        return self._get_dropbox_client_with_select_header(SELECT_USER_HEADER,
                                                           team_member_id)

    def _get_dropbox_client_with_select_header(self, select_header_name, team_member_id):
        """
        Get Dropbox client with modified headers

        :param str select_header_name: Header name used to select users
        :param str team_member_id: team member id of team member to perform actions with
        :return: A :class:`Dropbox` object that can be used to query on behalf
            of a member or admin of the team
        :rtype: Dropbox
        """

        new_headers = self._headers.copy() if self._headers else {}
        new_headers[select_header_name] = team_member_id
        return Dropbox(
            oauth2_access_token=self._oauth2_access_token,
            oauth2_refresh_token=self._oauth2_refresh_token,
            oauth2_access_token_expiration=self._oauth2_access_token_expiration,
            max_retries_on_error=self._max_retries_on_error,
            max_retries_on_rate_limit=self._max_retries_on_rate_limit,
            timeout=self._timeout,
            user_agent=self._raw_user_agent,
            session=self._session,
            headers=new_headers,
            app_key=self._app_key,
            app_secret=self._app_secret,
            scope=self._scope,
        )

class BadInputException(Exception):
    """
    Thrown if incorrect types/values are used

    This should only ever be thrown during testing, app should have validation of input prior to
    reaching this point
    """
    pass
