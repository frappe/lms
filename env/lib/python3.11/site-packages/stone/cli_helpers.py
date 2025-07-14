import abc

from ply import lex, yacc

_MYPY = False
if _MYPY:
    import typing  # noqa: F401 # pylint: disable=import-error,unused-import,useless-suppression


class FilterExprLexer:
    tokens = (
        'ID',
        'LPAR',
        'RPAR',
    )  # type: typing.Tuple[str, ...]

    # Conjunctions
    tokens += (
        'AND',
        'OR',
    )

    # Comparison operators
    tokens += (
        'NEQ',
        'EQ',
    )

    # Primitive types
    tokens += (
        'BOOLEAN',
        'FLOAT',
        'INTEGER',
        'NULL',
        'STRING',
    )

    t_LPAR = r'\('
    t_RPAR = r'\)'
    t_NEQ = r'!='
    t_EQ = r'='

    t_ignore = ' '

    KEYWORDS = {
        'and': 'AND',
        'or': 'OR',
    }

    def __init__(self, debug=False):
        self.lexer = lex.lex(module=self, debug=debug)
        self.errors = []

    def get_yacc_compat_lexer(self):
        return self.lexer

    def t_BOOLEAN(self, token):
        r'\btrue\b|\bfalse\b'
        token.value = (token.value == 'true')
        return token

    def t_NULL(self, token):
        r'\bnull\b'
        token.value = None
        return token

    def t_FLOAT(self, token):
        r'-?\d+(\.\d*(e-?\d+)?|e-?\d+)'
        token.value = float(token.value)
        return token

    def t_INTEGER(self, token):
        r'-?\d+'
        token.value = int(token.value)
        return token

    def t_STRING(self, token):
        r'\"([^\\"]|(\\.))*\"'
        token.value = token.value[1:-1]
        return token

    def t_ID(self, token):
        r'[a-zA-Z_][a-zA-Z0-9_-]*'
        if token.value in self.KEYWORDS:
            token.type = self.KEYWORDS[token.value]
            return token
        else:
            return token

    # Error handling rule
    def t_error(self, token):
        self.errors.append(
            'Illegal character %s.' % repr(token.value[0]).lstrip('u'))
        token.lexer.skip(1)

    # Test output
    def test(self, data):
        self.lexer.input(data)
        while True:
            tok = self.lexer.token()
            if not tok:
                break
            print(tok)


class FilterExprParser:
    # Ply parser requiment: Tokens must be re-specified in parser
    tokens = FilterExprLexer.tokens

    # Ply wants a 'str' instance; this makes it work in Python 2 and 3
    start = 'expr'

    # To match most languages, give logical conjunctions a higher precedence
    # than logical disjunctions.
    precedence = (
        ('left', 'OR'),
        ('left', 'AND'),
    )

    def __init__(self, debug=False):
        self.debug = debug
        self.yacc = yacc.yacc(module=self, debug=debug, write_tables=debug)
        self.lexer = FilterExprLexer(debug)
        self.errors = []

    def parse(self, data):
        """
        Args:
            data (str): Raw filter expression.
        """
        parsed_data = self.yacc.parse(
            data, lexer=self.lexer.get_yacc_compat_lexer(), debug=self.debug)
        self.errors = self.lexer.errors + self.errors
        return parsed_data, self.errors

    def p_expr(self, p):
        'expr : pred'
        p[0] = p[1]

    def p_expr_parens(self, p):
        'expr : LPAR expr RPAR'
        p[0] = p[2]

    def p_expr_group(self, p):
        """expr : expr OR expr
                | expr AND expr"""
        p[0] = FilterExprConjunction(p[2], p[1], p[3])

    def p_pred(self, p):
        'pred : ID op primitive'
        p[0] = FilterExprPredicate(p[2], p[1], p[3])

    def p_op(self, p):
        """op : NEQ
              | EQ"""
        p[0] = p[1]

    def p_primitive(self, p):
        """primitive : BOOLEAN
                     | FLOAT
                     | INTEGER
                     | NULL
                     | STRING"""
        p[0] = p[1]

    def p_error(self, token):
        if token:
            self.errors.append(
                "Unexpected %s with value %s." %
                (token.type, repr(token.value).lstrip('u')))
        else:
            self.errors.append('Unexpected end of expression.')


class FilterExpr:
    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def eval(self, route):
        pass


class FilterExprConjunction:

    def __init__(self, conj, lhs, rhs):
        self.conj = conj
        self.lhs = lhs
        self.rhs = rhs

    def eval(self, route):
        if self.conj == 'and':
            return self.lhs.eval(route) and self.rhs.eval(route)
        elif self.conj == 'or':
            return self.lhs.eval(route) or self.rhs.eval(route)
        else:
            assert False

    def __repr__(self):
        return 'EvalConj({!r}, {!r}, {!r})'.format(self.conj, self.lhs, self.rhs)


class FilterExprPredicate:

    def __init__(self, op, lhs, rhs):
        self.op = op
        self.lhs = lhs
        self.rhs = rhs

    def eval(self, route):
        val = route.attrs.get(self.lhs, None)
        if self.op == '=':
            return val == self.rhs
        elif self.op == '!=':
            return val != self.rhs
        else:
            assert False

    def __repr__(self):
        return 'EvalPred({!r}, {!r}, {!r})'.format(self.op, self.lhs, self.rhs)


def parse_route_attr_filter(route_attr_filter, debug=False):
    """
    Args:
        route_attr_filter (str): The raw command-line input of the route
            filter.

    Returns:
        Tuple[FilterExpr, List[str]]: The second element is a list of errors.
    """
    assert isinstance(route_attr_filter, str), type(route_attr_filter)
    parser = FilterExprParser(debug)
    return parser.parse(route_attr_filter)
