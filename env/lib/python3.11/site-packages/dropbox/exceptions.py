class DropboxException(Exception):
    """All errors related to making an API request extend this."""

    def __init__(self, request_id, *args, **kwargs):
        # A request_id can be shared with Dropbox Support to pinpoint the exact
        # request that returns an error.
        super(DropboxException, self).__init__(request_id, *args, **kwargs)
        self.request_id = request_id

    def __str__(self):
        return repr(self)


class ApiError(DropboxException):
    """Errors produced by the Dropbox API."""

    def __init__(self, request_id, error, user_message_text, user_message_locale):
        """
        :param (str) request_id: A request_id can be shared with Dropbox
            Support to pinpoint the exact request that returns an error.
        :param error: An instance of the error data type for the route.
        :param (str) user_message_text: A human-readable message that can be
            displayed to the end user. Is None, if unavailable.
        :param (str) user_message_locale: The locale of ``user_message_text``,
            if present.
        """
        super(ApiError, self).__init__(request_id, error)
        self.error = error
        self.user_message_text = user_message_text
        self.user_message_locale = user_message_locale

    def __repr__(self):
        return 'ApiError({!r}, {})'.format(self.request_id, self.error)


class HttpError(DropboxException):
    """Errors produced at the HTTP layer."""

    def __init__(self, request_id, status_code, body):
        super(HttpError, self).__init__(request_id, status_code, body)
        self.status_code = status_code
        self.body = body

    def __repr__(self):
        return 'HttpError({!r}, {}, {!r})'.format(self.request_id,
            self.status_code, self.body)


class PathRootError(HttpError):
    """Error caused by an invalid path root."""

    def __init__(self, request_id, error=None):
        super(PathRootError, self).__init__(request_id, 422, None)
        self.error = error

    def __repr__(self):
        return 'PathRootError({!r}, {!r})'.format(self.request_id, self.error)


class BadInputError(HttpError):
    """Errors due to bad input parameters to an API Operation."""

    def __init__(self, request_id, message):
        super(BadInputError, self).__init__(request_id, 400, message)
        self.message = message

    def __repr__(self):
        return 'BadInputError({!r}, {!r})'.format(self.request_id, self.message)


class AuthError(HttpError):
    """Errors due to invalid authentication credentials."""

    def __init__(self, request_id, error):
        super(AuthError, self).__init__(request_id, 401, None)
        self.error = error

    def __repr__(self):
        return 'AuthError({!r}, {!r})'.format(self.request_id, self.error)


class RateLimitError(HttpError):
    """Error caused by rate limiting."""

    def __init__(self, request_id, error=None, backoff=None):
        super(RateLimitError, self).__init__(request_id, 429, None)
        self.error = error
        self.backoff = backoff

    def __repr__(self):
        return 'RateLimitError({!r}, {!r}, {!r})'.format(
            self.request_id, self.error, self.backoff)


class InternalServerError(HttpError):
    """Errors due to a problem on Dropbox."""

    def __repr__(self):
        return 'InternalServerError({!r}, {}, {!r})'.format(
            self.request_id, self.status_code, self.body)
