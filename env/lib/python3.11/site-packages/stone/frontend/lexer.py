import logging
import os

import ply.lex as lex

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression


class MultiToken:
    """Object used to monkeypatch ply.lex so that we can return multiple
    tokens from one lex operation."""
    def __init__(self, tokens):
        self.type = tokens[0].type
        self.tokens = tokens

# Represents a null value. We want to differentiate between the Python "None"
# and null in several places.
NullToken = object()


class Lexer:
    """
    Lexer. Tokenizes stone files.
    """

    states = (
        ('WSIGNORE', 'inclusive'),
    )

    def __init__(self):
        self.lex = None
        self.tokens_queue = None
        # The current indentation "level" rather than a count of spaces.
        self.cur_indent = None
        self._logger = logging.getLogger('stone.stone.lexer')
        self.last_token = None
        # [(character, line number), ...]
        self.errors = []

    def input(self, file_data, **kwargs):
        """
        Required by ply.yacc for this to quack (duck typing) like a ply lexer.

        :param str file_data: Contents of the file to lex.
        """
        self.lex = lex.lex(module=self, **kwargs)
        self.tokens_queue = []
        self.cur_indent = 0
        # Hack to avoid tokenization bugs caused by files that do not end in a
        # new line.
        self.lex.input(file_data + '\n')

    def token(self):
        """
        Returns the next LexToken. Returns None when all tokens have been
        exhausted.
        """

        if self.tokens_queue:
            self.last_token = self.tokens_queue.pop(0)
        else:
            r = self.lex.token()
            if isinstance(r, MultiToken):
                self.tokens_queue.extend(r.tokens)
                self.last_token = self.tokens_queue.pop(0)
            else:
                if r is None and self.cur_indent > 0:
                    if (self.last_token and
                            self.last_token.type not in ('NEWLINE', 'LINE')):
                        newline_token = _create_token(
                            'NEWLINE', '\n', self.lex.lineno, self.lex.lexpos)
                        self.tokens_queue.append(newline_token)
                    dedent_count = self.cur_indent
                    dedent_token = _create_token(
                        'DEDENT', '\t', self.lex.lineno, self.lex.lexpos)
                    self.tokens_queue.extend([dedent_token] * dedent_count)

                    self.cur_indent = 0
                    self.last_token = self.tokens_queue.pop(0)
                else:
                    self.last_token = r
        return self.last_token

    def test(self, data):
        """Logs all tokens for human inspection. Useful for debugging."""
        self.input(data)
        while True:
            token = self.token()
            if not token:
                break
            self._logger.debug('Token %r', token)

    # List of token names
    tokens = (
        'ID',
        'KEYWORD',
        'PATH',
        'DOT',
    )  # type: typing.Tuple[typing.Text, ...]

    # Whitespace tokens
    tokens += (
        'DEDENT',
        'INDENT',
        'NEWLINE',
    )

    # Attribute lists, aliases
    tokens += (
        'COMMA',
        'EQ',
        'LPAR',
        'RPAR',
    )

    # Primitive types
    tokens += (
        'BOOLEAN',
        'FLOAT',
        'INTEGER',
        'NULL',
        'STRING',
    )

    # List notation
    tokens += (
        'LBRACKET',
        'RBRACKET',
    )

    # Map notation
    tokens += (
        'LBRACE',
        'RBRACE',
        'COLON',
    )

    tokens += (
        'Q',
    )

    # Annotation notation
    tokens += (
        'AT',
    )

    # Regular expression rules for simple tokens
    t_DOT = r'\.'
    t_LBRACKET = r'\['
    t_RBRACKET = r'\]'
    t_EQ = r'='
    t_COMMA = r','
    t_Q = r'\?'
    t_LBRACE = r'\{'
    t_RBRACE = r'\}'
    t_COLON = r'\:'
    t_AT = r'@'

    # TODO(kelkabany): Use scoped/conditional lexing to restrict where keywords
    # are identified as such.
    KEYWORDS = [
        'alias',
        'annotation',
        'annotation_type',
        'attrs',
        'by',
        'deprecated',
        'doc',
        'example',
        'error',
        'extends',
        'import',
        'namespace',
        'patch',
        'route',
        'struct',
        'union',
        'union_closed',
    ]

    RESERVED = {
        'annotation': 'ANNOTATION',
        'annotation_type': 'ANNOTATION_TYPE',
        'attrs': 'ATTRS',
        'deprecated': 'DEPRECATED',
        'by': 'BY',
        'extends': 'EXTENDS',
        'import': 'IMPORT',
        'patch': 'PATCH',
        'route': 'ROUTE',
        'struct': 'STRUCT',
        'union': 'UNION',
        'union_closed': 'UNION_CLOSED',
    }

    tokens += tuple(RESERVED.values())

    def t_LPAR(self, token):
        r'\('
        token.lexer.push_state('WSIGNORE')
        return token

    def t_RPAR(self, token):
        r'\)'
        token.lexer.pop_state()
        return token

    def t_ANY_BOOLEAN(self, token):
        r'\btrue\b|\bfalse\b'
        token.value = (token.value == 'true')
        return token

    def t_ANY_NULL(self, token):
        r'\bnull\b'
        token.value = NullToken
        return token

    # No leading digits
    def t_ANY_ID(self, token):
        r'[a-zA-Z_][a-zA-Z0-9_-]*'
        if token.value in self.KEYWORDS:
            if (token.value == 'annotation_type') and self.cur_indent:
                # annotation_type was added as a reserved keyword relatively
                # late, when there could be identifers with the same name
                # in existing specs. because annotation_type-the-keyword can
                # only be used at the beginning of a non-indented line, this
                # check lets both the keyword and the identifer coexist and
                # maintains backward compatibility.
                # Note: this is kind of a hack, and we should get rid of it if
                # the lexer gets better at telling keywords from identifiers in general.
                return token
            token.type = self.RESERVED.get(token.value, 'KEYWORD')
            return token
        else:
            return token

    def t_ANY_PATH(self, token):
        r'\/[/a-zA-Z0-9_-]*'
        return token

    def t_ANY_FLOAT(self, token):
        r'-?\d+(\.\d*(e-?\d+)?|e-?\d+)'
        token.value = float(token.value)
        return token

    def t_ANY_INTEGER(self, token):
        r'-?\d+'
        token.value = int(token.value)
        return token

    # Read in a string while respecting the following escape sequences:
    # \", \\, \n, and \t.
    def t_ANY_STRING(self, t):
        r'\"([^\\"]|(\\.))*\"'
        escaped = 0
        t.lexer.lineno += t.value.count('\n')
        s = t.value[1:-1]
        new_str = ""
        for i in range(0, len(s)):
            c = s[i]
            if escaped:
                if c == 'n':
                    c = '\n'
                elif c == 't':
                    c = '\t'
                new_str += c
                escaped = 0
            else:
                if c == '\\':
                    escaped = 1
                else:
                    new_str += c
        # remove current indentation
        indentation_str = ' ' * _indent_level_to_spaces_count(self.cur_indent)
        lines_without_indentation = [
            line.replace(indentation_str, '', 1)
            for line in new_str.splitlines()]
        t.value = '\n'.join(lines_without_indentation)
        return t

    # Ignore comments.
    # There are two types of comments.
    # 1. Comments that take up a full line. These lines are ignored entirely.
    # 2. Comments that come after tokens in the same line. These comments
    #    are ignored, but, we still need to emit a NEWLINE since this rule
    #    takes all trailing newlines.
    # Regardless of comment type, the following line must be checked for a
    # DEDENT or INDENT.
    def t_INITIAL_comment(self, token):
        r'[#][^\n]*\n+'
        token.lexer.lineno += token.value.count('\n')
        # Scan backwards from the comment hash to figure out which type of
        # comment this is. If we find an non-ws character, we know it was a
        # partial line. But, if we find a newline before a non-ws character,
        # then we know the entire line was a comment.
        i = token.lexpos - 1
        while i >= 0:
            is_full_line_comment = token.lexer.lexdata[i] == '\n'
            is_partial_line_comment = (not is_full_line_comment and
                                       token.lexer.lexdata[i] != ' ')
            if is_full_line_comment or is_partial_line_comment:
                newline_token = _create_token('NEWLINE', '\n',
                    token.lineno, token.lexpos + len(token.value) - 1)
                newline_token.lexer = token.lexer
                dent_tokens = self._create_tokens_for_next_line_dent(
                    newline_token)
                if is_full_line_comment:
                    # Comment takes the full line so ignore entirely.
                    return dent_tokens
                elif is_partial_line_comment:
                    # Comment is only a partial line. Preserve newline token.
                    if dent_tokens:
                        dent_tokens.tokens.insert(0, newline_token)
                        return dent_tokens
                    else:
                        return newline_token
            i -= 1

    def t_WSIGNORE_comment(self, token):
        r'[#][^\n]*\n+'
        token.lexer.lineno += token.value.count('\n')
        newline_token = _create_token('NEWLINE', '\n',
            token.lineno, token.lexpos + len(token.value) - 1)
        newline_token.lexer = token.lexer
        self._check_for_indent(newline_token)

    # Define a rule so we can track line numbers
    def t_INITIAL_NEWLINE(self, newline_token):
        r'\n+'
        newline_token.lexer.lineno += newline_token.value.count('\n')
        dent_tokens = self._create_tokens_for_next_line_dent(newline_token)
        if dent_tokens:
            dent_tokens.tokens.insert(0, newline_token)
            return dent_tokens
        else:
            return newline_token

    def t_WSIGNORE_NEWLINE(self, newline_token):
        r'\n+'
        newline_token.lexer.lineno += newline_token.value.count('\n')
        self._check_for_indent(newline_token)

    def _create_tokens_for_next_line_dent(self, newline_token):
        """
        Starting from a newline token that isn't followed by another newline
        token, returns any indent or dedent tokens that immediately follow.
        If indentation doesn't change, returns None.
        """
        indent_delta = self._get_next_line_indent_delta(newline_token)
        if indent_delta is None or indent_delta == 0:
            # Next line's indent isn't relevant OR there was no change in
            # indentation.
            return None

        dent_type = 'INDENT' if indent_delta > 0 else 'DEDENT'
        dent_token = _create_token(
            dent_type, '\t', newline_token.lineno + 1,
            newline_token.lexpos + len(newline_token.value))

        tokens = [dent_token] * abs(indent_delta)
        self.cur_indent += indent_delta
        return MultiToken(tokens)

    def _check_for_indent(self, newline_token):
        """
        Checks that the line following a newline is indented, otherwise a
        parsing error is generated.
        """
        indent_delta = self._get_next_line_indent_delta(newline_token)
        if indent_delta is None or indent_delta == 1:
            # Next line's indent isn't relevant (e.g. it's a comment) OR
            # next line is correctly indented.
            return None
        else:
            self.errors.append(
                ('Line continuation must increment indent by 1.',
                 newline_token.lexer.lineno))

    def _get_next_line_indent_delta(self, newline_token):
        """
        Returns the change in indentation. The return units are in
        indentations rather than spaces/tabs.

        If the next line's indent isn't relevant (e.g. it's a comment),
        returns None. Since the return value might be 0, the caller should
        explicitly check the return type, rather than rely on truthiness.
        """
        assert newline_token.type == 'NEWLINE', \
            'Can only search for a dent starting from a newline.'
        next_line_pos = newline_token.lexpos + len(newline_token.value)
        if next_line_pos == len(newline_token.lexer.lexdata):
            # Reached end of file
            return None

        line = newline_token.lexer.lexdata[next_line_pos:].split(os.linesep, 1)[0]
        if not line:
            return None
        lstripped_line = line.lstrip()
        lstripped_line_length = len(lstripped_line)
        if lstripped_line_length == 0:
            # If the next line is composed of only spaces, ignore indentation.
            return None
        if lstripped_line[0] == '#':
            # If it's a comment line, ignore indentation.
            return None

        indent = len(line) - lstripped_line_length
        if indent % 4 > 0:
            self.errors.append(
                ('Indent is not divisible by 4.', newline_token.lexer.lineno))
            return None

        indent_delta = indent - _indent_level_to_spaces_count(self.cur_indent)
        return indent_delta // 4

    # A string containing ignored characters (spaces and tabs)
    t_ignore = ' \t'

    # Error handling rule
    def t_ANY_error(self, token):
        self._logger.debug('Illegal character %r at line %d',
                           token.value[0], token.lexer.lineno)
        self.errors.append(
            ('Illegal character %s.' % repr(token.value[0]).lstrip('u'),
             token.lexer.lineno))
        token.lexer.skip(1)


def _create_token(token_type, value, lineno, lexpos):
    """
    Helper for creating ply.lex.LexToken objects. Unfortunately, LexToken
    does not have a constructor defined to make settings these values easy.
    """
    token = lex.LexToken()
    token.type = token_type
    token.value = value
    token.lineno = lineno
    token.lexpos = lexpos
    return token

def _indent_level_to_spaces_count(indent):
    return indent * 4
