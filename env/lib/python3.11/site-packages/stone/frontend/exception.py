class InvalidSpec(Exception):
    """Raise this to indicate there was an error in a specification."""

    def __init__(self, msg, lineno, path=None):
        """
        Args:
            msg: Error message intended for the spec writer to read.
            lineno: The line number the error occurred on.
            path: Path to the spec file with the error.
        """
        super().__init__()
        assert isinstance(msg, str), type(msg)
        assert isinstance(lineno, ((int,), type(None))), type(lineno)
        self.msg = msg
        self.lineno = lineno
        self.path = path

    def __str__(self):
        return repr(self)

    def __repr__(self):
        return 'InvalidSpec({!r}, {!r}, {!r})'.format(
            self.msg,
            self.lineno,
            self.path,
        )
