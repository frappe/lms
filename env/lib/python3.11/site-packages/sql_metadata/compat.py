"""
This module provides a temporary compatibility layer
for legacy API dating back to 1.x version.

Change your old imports:

from sql_metadata import get_query_columns, get_query_tables

into:

from sql_metadata.compat import get_query_columns, get_query_tables

"""

# pylint:disable=missing-function-docstring
from typing import List, Optional, Tuple

import sqlparse
from sqlparse.sql import TokenList
from sqlparse.tokens import Whitespace

from sql_metadata import Parser


def preprocess_query(query: str) -> str:
    return Parser(query).query


def get_query_tokens(query: str) -> List[sqlparse.sql.Token]:
    query = preprocess_query(query)
    parsed = sqlparse.parse(query)

    # handle empty queries (#12)
    if not parsed:
        return []

    tokens = TokenList(parsed[0].tokens).flatten()

    return [token for token in tokens if token.ttype is not Whitespace]


def get_query_columns(query: str) -> List[str]:
    return Parser(query).columns


def get_query_tables(query: str) -> List[str]:
    return Parser(query).tables


def get_query_limit_and_offset(query: str) -> Optional[Tuple[int, int]]:
    return Parser(query).limit_and_offset


def generalize_sql(query: Optional[str] = None) -> Optional[str]:
    if query is None:
        return None

    return Parser(query).generalize
