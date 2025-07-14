import logging

from .exception import InvalidSpec
from .parser import (
    ParserFactory,
)
from .ir_generator import IRGenerator

logger = logging.getLogger('stone.frontend.frontend')


# FIXME: Version should not have a default.
def specs_to_ir(specs, version='0.1b1', debug=False, route_whitelist_filter=None):
    """
    Converts a collection of Stone specifications into the intermediate
    representation used by Stone backends.

    The process is: Lexer -> Parser -> Semantic Analyzer -> IR Generator.

    The code is structured as:
        1. Parser (Lexer embedded within)
        2. IR Generator (Semantic Analyzer embedded within)

    :type specs: List[Tuple[path: str, text: str]]
    :param specs: `path` is never accessed and is only used to report the
        location of a bad spec to the user. `spec` is the text contents of
        a spec (.stone) file.

    :raises: InvalidSpec

    :returns: stone.ir.Api
    """

    parser_factory = ParserFactory(debug=debug)
    partial_asts = []

    for path, text in specs:
        logger.info('Parsing spec %s', path)
        parser = parser_factory.get_parser()
        if debug:
            parser.test_lexing(text)

        partial_ast = parser.parse(text, path)

        if parser.got_errors_parsing():
            # TODO(kelkabany): Show more than one error at a time.
            msg, lineno, path = parser.get_errors()[0]
            raise InvalidSpec(msg, lineno, path)
        elif len(partial_ast) == 0:
            logger.info('Empty spec: %s', path)
        else:
            partial_asts.append(partial_ast)

    return IRGenerator(partial_asts, version, debug=debug,
                       route_whitelist_filter=route_whitelist_filter).generate_IR()
