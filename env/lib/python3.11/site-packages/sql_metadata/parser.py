# pylint: disable=C0302
"""
This module provides SQL query parsing functions
"""
import logging
import re
from typing import Dict, List, Optional, Set, Tuple, Union

import sqlparse
from sqlparse.sql import Token
from sqlparse.tokens import Name, Number, Whitespace

from sql_metadata.generalizator import Generalizator
from sql_metadata.keywords_lists import (
    COLUMNS_SECTIONS,
    KEYWORDS_BEFORE_COLUMNS,
    TokenType,
    RELEVANT_KEYWORDS,
    SUBQUERY_PRECEDING_KEYWORDS,
    SUPPORTED_QUERY_TYPES,
    TABLE_ADJUSTMENT_KEYWORDS,
    WITH_ENDING_KEYWORDS,
)
from sql_metadata.token import EmptyToken, SQLToken
from sql_metadata.utils import UniqueList, flatten_list


class Parser:  # pylint: disable=R0902
    """
    Main class to parse sql query
    """

    def __init__(self, sql: str = "", disable_logging: bool = False) -> None:
        self._logger = logging.getLogger(self.__class__.__name__)
        self._logger.disabled = disable_logging

        self._raw_query = sql
        self._query = self._preprocess_query()
        self._query_type = None

        self._tokens = None

        self._columns = None
        self._columns_dict = None
        self._columns_aliases_names = None
        self._columns_aliases = None
        self._columns_with_tables_aliases = {}
        self._columns_aliases_dict = None

        self._tables = None
        self._table_aliases = None

        self._with_names = None
        self._with_queries = None
        self._with_queries_columns = None
        self._subqueries = None
        self._subqueries_names = None
        self._subqueries_parsers = {}
        self._with_parsers = {}

        self._limit_and_offset = None

        self._values = None
        self._values_dict = None

        self._subquery_level = 0
        self._nested_level = 0
        self._parenthesis_level = 0
        self._open_parentheses: List[SQLToken] = []
        self._preceded_keywords: List[SQLToken] = []
        self._aliases_to_check = None
        self._is_in_nested_function = False
        self._is_in_with_block = False
        self._with_columns_candidates = {}
        self._column_aliases_max_subquery_level = {}

        self.sqlparse_tokens = None
        self.non_empty_tokens = None
        self.tokens_length = None

    @property
    def query(self) -> str:
        """
        Returns preprocessed query
        """
        return self._query.replace("\n", " ").replace("  ", " ")

    @property
    def query_type(self) -> str:
        """
        Returns type of the query.
        Currently supported queries are:
        select, insert, update, replace, create table, alter table, with + select
        """
        if self._query_type:
            return self._query_type
        if not self._tokens:
            _ = self.tokens

        # remove comment tokens to not confuse the logic below (see #163)
        tokens: List[SQLToken] = list(
            filter(lambda token: not token.is_comment, self._tokens or [])
        )

        if not tokens:
            raise ValueError("Empty queries are not supported!")

        index = (
            0
            if not tokens[0].is_left_parenthesis
            else tokens[0]
            .find_nearest_token(
                value=False, value_attribute="is_left_parenthesis", direction="right"
            )
            .position
        )
        if tokens[index].normalized in ["CREATE", "ALTER", "DROP"]:
            switch = tokens[index].normalized + tokens[index + 1].normalized
        else:
            switch = tokens[index].normalized
        self._query_type = SUPPORTED_QUERY_TYPES.get(switch, "UNSUPPORTED")
        if self._query_type == "UNSUPPORTED":
            self._logger.error("Not supported query type: %s", self._raw_query)
            raise ValueError("Not supported query type!")
        return self._query_type

    @property
    def tokens(self) -> List[SQLToken]:  # noqa: C901
        """
        Tokenizes the query
        """
        if self._tokens is not None:
            return self._tokens

        parsed = sqlparse.parse(self._query)
        tokens = []
        # handle empty queries (#12)
        if not parsed:
            return tokens
        self._get_sqlparse_tokens(parsed)
        last_keyword = None
        combine_flag = False
        for index, tok in enumerate(self.non_empty_tokens):
            # combine dot separated identifiers
            if self._is_token_part_of_complex_identifier(token=tok, index=index):
                combine_flag = True
                continue
            token = SQLToken(
                tok=tok,
                index=index,
                subquery_level=self._subquery_level,
                last_keyword=last_keyword,
            )
            if combine_flag:
                self._combine_qualified_names(index=index, token=token)
                combine_flag = False

            previous_token = tokens[-1] if index > 0 else EmptyToken
            token.previous_token = previous_token
            previous_token.next_token = token if index > 0 else None

            if token.is_left_parenthesis:
                token.token_type = TokenType.PARENTHESIS
                self._determine_opening_parenthesis_type(token=token)
            elif token.is_right_parenthesis:
                token.token_type = TokenType.PARENTHESIS
                self._determine_closing_parenthesis_type(token=token)
                if token.is_subquery_end:
                    last_keyword = self._preceded_keywords.pop()

            last_keyword = self._determine_last_relevant_keyword(
                token=token, last_keyword=last_keyword
            )
            token.is_in_nested_function = self._is_in_nested_function
            token.parenthesis_level = self._parenthesis_level
            tokens.append(token)

        self._tokens = tokens
        # since tokens are used in all methods required parsing (so w/o generalization)
        # we set the query type here (and not in init) to allow for generalization
        # but disallow any other usage for not supported queries to avoid unexpected
        # results which are not really an error
        _ = self.query_type
        return tokens

    @property
    def columns(self) -> List[str]:
        """
        Returns the list columns this query refers to
        """
        if self._columns is not None:
            return self._columns
        columns = UniqueList()

        for token in self._not_parsed_tokens:
            if token.is_name or token.is_keyword_column_name:
                if token.is_column_definition_inside_create_table(
                    query_type=self.query_type
                ):
                    token.token_type = TokenType.COLUMN
                    columns.append(token.value)
                elif (
                    token.is_potential_column_name
                    and token.is_not_an_alias_or_is_self_alias_outside_of_subquery(
                        columns_aliases_names=self.columns_aliases_names,
                        max_subquery_level=self._column_aliases_max_subquery_level,
                    )
                    and not token.is_sub_query_name_or_with_name_or_function_name(
                        sub_queries_names=self.subqueries_names,
                        with_names=self.with_names,
                    )
                    and not token.is_table_definition_suffix_in_non_select_create_table(
                        query_type=self.query_type
                    )
                    and not token.is_conversion_specifier
                ):
                    self._handle_column_save(token=token, columns=columns)

                elif token.is_column_name_inside_insert_clause:
                    column = str(token.value).strip("`")
                    self._add_to_columns_subsection(
                        keyword=token.last_keyword_normalized, column=column
                    )
                    token.token_type = TokenType.COLUMN
                    columns.append(column)
            elif token.is_a_wildcard_in_select_statement:
                self._handle_column_save(token=token, columns=columns)

        self._columns = columns
        return self._columns

    @property
    def columns_dict(self) -> Dict[str, List[str]]:
        """
        Returns dictionary of column names divided into section of the query in which
        given column is present.

        Sections consist of: select, where, order_by, group_by, join, insert and update
        """
        if not self._columns_dict:
            _ = self.columns
        if self.columns_aliases_dict:
            for key, value in self.columns_aliases_dict.items():
                for alias in value:
                    resolved = self._resolve_column_alias(alias)
                    if isinstance(resolved, list):
                        for res_alias in resolved:
                            self._columns_dict.setdefault(key, UniqueList()).append(
                                res_alias
                            )
                    else:
                        self._columns_dict.setdefault(key, UniqueList()).append(
                            resolved
                        )
        return self._columns_dict

    @property
    def columns_aliases(self) -> Dict:
        """
        Returns a dictionary of column aliases with columns
        """
        if self._columns_aliases is not None:
            return self._columns_aliases
        column_aliases = {}
        _ = self.columns
        self._aliases_to_check = (
            list(self._columns_with_tables_aliases.keys())
            + self.columns_aliases_names
            + ["*"]
        )
        for token in self.tokens:
            if token.is_potential_column_alias(
                column_aliases=column_aliases,
                columns_aliases_names=self.columns_aliases_names,
            ):
                token_check = (
                    token.previous_token
                    if not token.previous_token.is_as_keyword
                    else token.get_nth_previous(2)
                )
                if token_check.is_column_definition_end:
                    alias_of = self._resolve_subquery_alias(token=token)
                elif token_check.is_partition_clause_end:
                    start_token = token.find_nearest_token(
                        True, value_attribute="is_partition_clause_start"
                    )
                    alias_of = self._find_all_columns_between_tokens(
                        start_token=start_token, end_token=token
                    )
                elif token.is_in_with_columns:
                    # columns definition is to the right in subquery
                    # we are in: with with_name (<aliases>) as (subquery)
                    alias_of = self._find_column_for_with_column_alias(token)
                else:
                    alias_of = self._resolve_function_alias(token=token)
                if token.value != alias_of:
                    # skip aliases of self, like sum(column) as column
                    column_aliases[token.value] = alias_of

        self._columns_aliases = column_aliases
        return self._columns_aliases

    @property
    def columns_aliases_dict(self) -> Dict[str, List[str]]:
        """
        Returns dictionary of column names divided into section of the query in which
        given column is present.

        Sections consist of: select, where, order_by, group_by, join, insert and update
        """
        if self._columns_aliases_dict:
            return self._columns_aliases_dict
        _ = self.columns_aliases_names
        return self._columns_aliases_dict

    @property
    def columns_aliases_names(self) -> List[str]:
        """
        Extract names of the column aliases used in query
        """
        if self._columns_aliases_names is not None:
            return self._columns_aliases_names
        column_aliases_names = UniqueList()
        with_names = self.with_names
        subqueries_names = self.subqueries_names
        for token in self._not_parsed_tokens:
            if token.is_potential_alias:
                if token.value in column_aliases_names:
                    self._handle_column_alias_subquery_level_update(token=token)
                elif (
                    token.is_a_valid_alias
                    and token.value not in with_names + subqueries_names
                ):
                    column_aliases_names.append(token.value)
                    self._handle_column_alias_subquery_level_update(token=token)

        self._columns_aliases_names = column_aliases_names
        return self._columns_aliases_names

    @property
    def tables(self) -> List[str]:
        """
        Return the list of tables this query refers to
        """
        if self._tables is not None:
            return self._tables
        tables = UniqueList()
        with_names = self.with_names

        for token in self._not_parsed_tokens:
            if token.is_potential_table_name:
                if (
                    token.is_alias_of_table_or_alias_of_subquery
                    or token.is_with_statement_nested_in_subquery
                    or token.is_constraint_definition_inside_create_table_clause(
                        query_type=self.query_type
                    )
                    or token.is_columns_alias_of_with_query_or_column_in_insert_query(
                        with_names=with_names
                    )
                ):
                    continue

                # handle INSERT INTO ON DUPLICATE KEY UPDATE queries
                if (
                    token.last_keyword_normalized == "UPDATE"
                    and self.query_type == "INSERT"
                ):
                    continue

                table_name = str(token.value.strip("`"))
                token.token_type = TokenType.TABLE
                tables.append(table_name)

        self._tables = tables - with_names
        return self._tables

    @property
    def limit_and_offset(self) -> Optional[Tuple[int, int]]:
        """
        Returns value for limit and offset if set
        """
        if self._limit_and_offset is not None:
            return self._limit_and_offset
        limit = None
        offset = None

        for token in self._not_parsed_tokens:
            if token.is_integer:
                if token.last_keyword_normalized == "LIMIT" and not limit:
                    # LIMIT <limit>
                    limit = int(token.value)
                elif token.last_keyword_normalized == "OFFSET":
                    # OFFSET <offset>
                    offset = int(token.value)
                elif (
                    token.previous_token.is_punctuation
                    and token.last_keyword_normalized == "LIMIT"
                ):
                    # LIMIT <offset>,<limit>
                    #  enter this condition only when the limit has already been parsed
                    offset = limit
                    limit = int(token.value)

        if limit is None:
            return None

        self._limit_and_offset = limit, offset or 0
        return self._limit_and_offset

    @property
    def tables_aliases(self) -> Dict[str, str]:
        """
        Returns tables aliases mapping from a given query

        E.g. SELECT a.* FROM users1 AS a JOIN users2 AS b ON a.ip_address = b.ip_address
        will give you {'a': 'users1', 'b': 'users2'}
        """
        if self._table_aliases is not None:
            return self._table_aliases
        aliases = {}
        tables = self.tables

        for token in self._not_parsed_tokens:
            if (
                token.last_keyword_normalized in TABLE_ADJUSTMENT_KEYWORDS
                and (token.is_name or (token.is_keyword and not token.is_as_keyword))
                and not token.next_token.is_as_keyword
            ):
                if token.previous_token.is_as_keyword:
                    # potential <DB.<SCHEMA>.<TABLE> as <ALIAS>
                    potential_table_name = token.get_nth_previous(2).value
                else:
                    # potential <DB.<SCHEMA>.<TABLE> <ALIAS>
                    potential_table_name = token.previous_token.value

                if potential_table_name in tables:
                    token.token_type = TokenType.TABLE_ALIAS
                    aliases[token.value] = potential_table_name

        self._table_aliases = aliases
        return self._table_aliases

    @property
    def with_names(self) -> List[str]:
        """
        Returns with statements aliases list from a given query

        E.g. WITH database1.tableFromWith AS (SELECT * FROM table3)
             SELECT "xxxxx" FROM database1.tableFromWith alias
             LEFT JOIN database2.table2 ON ("tt"."ttt"."fff" = "xx"."xxx")
        will return ["database1.tableFromWith"]
        """
        if self._with_names is not None:
            return self._with_names
        with_names = UniqueList()
        for token in self._not_parsed_tokens:
            if token.previous_token.normalized == "WITH":
                self._is_in_with_block = True
                while self._is_in_with_block and token.next_token:
                    if token.next_token.is_as_keyword:
                        self._handle_with_name_save(token=token, with_names=with_names)
                        while token.next_token and not token.is_with_query_end:
                            token = token.next_token
                        is_end_of_with_block = (
                            token.next_token_not_comment is None
                            or token.next_token_not_comment.normalized
                            in WITH_ENDING_KEYWORDS
                        )
                        if is_end_of_with_block:
                            self._is_in_with_block = False
                    else:
                        token = token.next_token

        self._with_names = with_names
        return self._with_names

    @property
    def with_queries(self) -> Dict[str, str]:
        """
        Returns "WITH" subqueries with names

        E.g. WITH tableFromWith AS (SELECT * FROM table3)
             SELECT "xxxxx" FROM database1.tableFromWith alias
             LEFT JOIN database2.table2 ON ("tt"."ttt"."fff" = "xx"."xxx")
        will return {"tableFromWith": "SELECT * FROM table3"}
        """
        if self._with_queries is not None:
            return self._with_queries
        with_queries = {}
        with_queries_columns = {}
        for name in self.with_names:
            token = self.tokens[0].find_nearest_token(
                name, value_attribute="value", direction="right"
            )
            if token.next_token.is_with_columns_start:
                with_queries_columns[name] = True
            else:
                with_queries_columns[name] = False
            current_with_query = []
            with_start = token.find_nearest_token(
                True, value_attribute="is_with_query_start", direction="right"
            )
            with_end = with_start.find_nearest_token(
                True, value_attribute="is_with_query_end", direction="right"
            )
            query_token = with_start.next_token
            while query_token is not None and query_token != with_end:
                current_with_query.append(query_token)
                query_token = query_token.next_token
            with_query_text = "".join([x.stringified_token for x in current_with_query])
            with_queries[name] = with_query_text
        self._with_queries = with_queries
        self._with_queries_columns = with_queries_columns
        return self._with_queries

    @property
    def subqueries(self) -> Dict:
        """
        Returns a dictionary with all sub-queries existing in query
        """
        if self._subqueries is not None:
            return self._subqueries
        subqueries = {}
        token = self.tokens[0]
        while token.next_token:
            if token.previous_token.is_subquery_start:
                current_subquery = []
                current_level = token.subquery_level
                inner_token = token
                while (
                    inner_token.next_token
                    and not inner_token.next_token.subquery_level < current_level
                ):
                    current_subquery.append(inner_token)
                    inner_token = inner_token.next_token

                query_name = None
                if inner_token.next_token.value in self.subqueries_names:
                    query_name = inner_token.next_token.value
                elif inner_token.next_token.is_as_keyword:
                    query_name = inner_token.next_token.next_token.value

                subquery_text = "".join([x.stringified_token for x in current_subquery])
                if query_name is not None:
                    subqueries[query_name] = subquery_text

            token = token.next_token

        self._subqueries = subqueries
        return self._subqueries

    @property
    def subqueries_names(self) -> List[str]:
        """
        Returns sub-queries aliases list from a given query

        e.g. SELECT COUNT(1) FROM
            (SELECT std.task_id FROM some_task_detail std WHERE std.STATUS = 1) a
             JOIN (SELECT st.task_id FROM some_task st WHERE task_type_id = 80) b
             ON a.task_id = b.task_id;
        will return ["a", "b"]
        """
        if self._subqueries_names is not None:
            return self._subqueries_names
        subqueries_names = UniqueList()
        for token in self.tokens:
            if (token.previous_token.is_subquery_end and not token.is_as_keyword) or (
                token.previous_token.is_as_keyword
                and token.get_nth_previous(2).is_subquery_end
            ):
                token.token_type = TokenType.SUB_QUERY_NAME
                subqueries_names.append(str(token))

        self._subqueries_names = subqueries_names
        return self._subqueries_names

    @property
    def values(self) -> List:
        """
        Returns list of values from insert queries
        """
        if self._values:
            return self._values
        values = []
        for token in self._not_parsed_tokens:
            if (
                token.last_keyword_normalized == "VALUES"
                and token.is_in_parenthesis
                and token.next_token.is_punctuation
            ):
                if token.is_integer:
                    value = int(token.value)
                elif token.is_float:
                    value = float(token.value)
                else:
                    value = token.value.strip("'\"")
                values.append(value)
        self._values = values
        return self._values

    @property
    def values_dict(self) -> Dict:
        """
        Returns dictionary of column-value pairs.
        If columns are not set the auto generated column_<col_number> are added.
        """
        values = self.values
        if self._values_dict or not values:
            return self._values_dict
        columns = self.columns
        if not columns:
            columns = [f"column_{ind + 1}" for ind in range(len(values))]
        values_dict = dict(zip(columns, values))
        self._values_dict = values_dict
        return self._values_dict

    @property
    def comments(self) -> List[str]:
        """
        Return comments from SQL query
        """
        return [x.value for x in self.tokens if x.is_comment]

    @property
    def without_comments(self) -> str:
        """
        Removes comments from SQL query
        """
        return Generalizator(self._raw_query).without_comments

    @property
    def generalize(self) -> str:
        """
        Removes most variables from an SQL query
        and replaces them with X or N for numbers.

        Based on Mediawiki's DatabaseBase::generalizeSQL
        """
        return Generalizator(self._raw_query).generalize

    @property
    def _not_parsed_tokens(self):
        """
        Returns only tokens that have no type assigned yet
        """
        return [x for x in self.tokens if x.token_type is None]

    def _handle_column_save(self, token: SQLToken, columns: List[str]):
        column = token.table_prefixed_column(self.tables_aliases)
        if self._is_with_query_already_resolved(column):
            self._add_to_columns_aliases_subsection(token=token, left_expand=False)
            token.token_type = TokenType.COLUMN_ALIAS
            return
        column = self._resolve_sub_queries(column)
        self._add_to_columns_with_tables(token, column)
        self._add_to_columns_subsection(
            keyword=token.last_keyword_normalized, column=column
        )
        token.token_type = TokenType.COLUMN
        columns.extend(column)

    @staticmethod
    def _handle_with_name_save(token: SQLToken, with_names: List[str]) -> None:
        if token.is_right_parenthesis:
            # inside columns of with statement
            # like: with (col1, col2) as (subquery)
            token.is_with_columns_end = True
            token.is_nested_function_end = False
            start_token = token.find_nearest_token("(")
            # like: with (col1, col2) as (subquery) as ..., it enters an infinite loop.
            # return exception
            if start_token.is_with_query_start:
                raise ValueError("This query is wrong")
            start_token.is_with_columns_start = True
            start_token.is_nested_function_start = False
            prev_token = start_token.previous_token
            prev_token.token_type = TokenType.WITH_NAME
            with_names.append(prev_token.value)
        else:
            token.token_type = TokenType.WITH_NAME
            with_names.append(token.value)

    def _handle_column_alias_subquery_level_update(self, token: SQLToken) -> None:
        token.token_type = TokenType.COLUMN_ALIAS
        self._add_to_columns_aliases_subsection(token=token)
        current_level = self._column_aliases_max_subquery_level.setdefault(
            token.value, 0
        )
        if token.subquery_level > current_level:
            self._column_aliases_max_subquery_level[token.value] = token.subquery_level

    def _resolve_subquery_alias(self, token: SQLToken) -> Union[str, List[str]]:
        # nested subquery like select a, (select a as b from x) as column
        start_token = token.find_nearest_token(
            True, value_attribute="is_column_definition_start"
        )
        if start_token.next_token.normalized == "SELECT":
            # we have a subquery
            alias_token = start_token.next_token.find_nearest_token(
                self._aliases_to_check,
                direction="right",
                value_attribute="value",
            )
            return self._resolve_alias_to_column(alias_token)

        # chain of functions or redundant parenthesis
        return self._find_all_columns_between_tokens(
            start_token=start_token, end_token=token
        )

    def _resolve_function_alias(self, token: SQLToken) -> Union[str, List[str]]:
        # it can be one function or a chain of functions
        # like: sum(a) + sum(b) as alias
        # or operation on columns like: col1 + col2 as alias
        start_token = token.find_nearest_token(
            [",", "SELECT"], value_attribute="normalized"
        )
        while start_token.is_in_nested_function:
            start_token = start_token.find_nearest_token(
                [",", "SELECT"], value_attribute="normalized"
            )
        return self._find_all_columns_between_tokens(
            start_token=start_token, end_token=token
        )

    def _add_to_columns_subsection(self, keyword: str, column: Union[str, List[str]]):
        """
        Add columns to the section in which it appears in query
        """
        section = COLUMNS_SECTIONS[keyword]
        self._columns_dict = self._columns_dict or {}
        current_section = self._columns_dict.setdefault(section, UniqueList())
        if isinstance(column, str):
            current_section.append(column)
        else:
            current_section.extend(column)

    def _add_to_columns_aliases_subsection(
        self, token: SQLToken, left_expand: bool = True
    ) -> None:
        """
        Add alias to the section in which it appears in query
        """
        keyword = token.last_keyword_normalized
        alias = token.value if left_expand else token.value.split(".")[-1]
        if (
            token.last_keyword_normalized in ["FROM", "WITH"]
            and token.find_nearest_token("(").is_with_columns_start
        ):
            keyword = "SELECT"
        section = COLUMNS_SECTIONS[keyword]
        self._columns_aliases_dict = self._columns_aliases_dict or {}
        self._columns_aliases_dict.setdefault(section, UniqueList()).append(alias)

    def _add_to_columns_with_tables(
        self, token: SQLToken, column: Union[str, List[str]]
    ) -> None:
        if isinstance(column, list) and len(column) == 1:
            column = column[0]
        self._columns_with_tables_aliases[token.value] = column

    def _resolve_column_alias(
        self, alias: Union[str, List[str]], visited: Set = None
    ) -> Union[str, List]:
        """
        Returns a column name for a given alias
        """
        visited = visited or set()
        if isinstance(alias, list):
            return [self._resolve_column_alias(x, visited) for x in alias]
        while alias in self.columns_aliases and alias not in visited:
            visited.add(alias)
            alias = self.columns_aliases[alias]
            if isinstance(alias, list):
                return self._resolve_column_alias(alias, visited)
        return alias

    def _resolve_alias_to_column(self, alias_token: SQLToken) -> str:
        """
        Resolves aliases of tables to already resolved columns
        """
        if alias_token.value in self._columns_with_tables_aliases:
            alias_of = self._columns_with_tables_aliases[alias_token.value]
        else:
            alias_of = alias_token.value
        return alias_of

    def _resolve_sub_queries(self, column: str) -> List[str]:
        """
        Resolve column names coming from sub queries and with queries to actual
        column names as they appear in the query
        """
        column = self._resolve_nested_query(
            subquery_alias=column,
            nested_queries_names=self.subqueries_names,
            nested_queries=self.subqueries,
            already_parsed=self._subqueries_parsers,
        )
        if isinstance(column, str):
            column = self._resolve_nested_query(
                subquery_alias=column,
                nested_queries_names=self.with_names,
                nested_queries=self.with_queries,
                already_parsed=self._with_parsers,
            )
        return column if isinstance(column, list) else [column]

    @staticmethod
    def _resolve_nested_query(
        subquery_alias: str,
        nested_queries_names: List[str],
        nested_queries: Dict,
        already_parsed: Dict,
    ) -> Union[str, List[str]]:
        """
        Resolves subquery reference to the actual column in the subquery
        """
        parts = subquery_alias.split(".")
        if len(parts) != 2 or parts[0] not in nested_queries_names:
            return subquery_alias
        sub_query, column_name = parts[0], parts[-1]
        sub_query_definition = nested_queries.get(sub_query)
        subparser = already_parsed.setdefault(sub_query, Parser(sub_query_definition))
        # in subquery you cannot have more than one column with given name
        # so it either has to have an alias or only one column with given name exists
        if column_name in subparser.columns_aliases_names:
            resolved_column = subparser._resolve_column_alias(  # pylint: disable=W0212
                column_name
            )
            if isinstance(resolved_column, list):
                resolved_column = flatten_list(resolved_column)
                return resolved_column
            return [resolved_column]

        if column_name == "*":
            return subparser.columns
        try:
            column_index = [x.split(".")[-1] for x in subparser.columns].index(
                column_name
            )
        except ValueError as exc:
            # handle case when column name is used but subquery select all by wildcard
            if "*" in subparser.columns:
                return column_name
            raise exc  # pragma: no cover
        resolved_column = subparser.columns[column_index]
        return [resolved_column]

    def _is_with_query_already_resolved(self, col_alias: str) -> bool:
        """
        Checks if columns comes from a with query that has columns defined
        cause if it does that means that column name is an alias and is already
        resolved in aliases.
        """
        parts = col_alias.split(".")
        if len(parts) != 2 or parts[0] not in self.with_names:
            return False
        if self._with_queries_columns.get(parts[0]):
            return True
        return False

    def _determine_opening_parenthesis_type(self, token: SQLToken):
        """
        Determines the type of left parenthesis in query
        """
        if token.previous_token.normalized in SUBQUERY_PRECEDING_KEYWORDS:
            # inside subquery / derived table
            token.is_subquery_start = True
            self._subquery_level += 1
            self._preceded_keywords.append(token.last_keyword_normalized)
            token.subquery_level = self._subquery_level
        elif token.previous_token.normalized in KEYWORDS_BEFORE_COLUMNS.union({","}):
            # we are in columns and in a column subquery definition
            token.is_column_definition_start = True
        elif (
            token.previous_token_not_comment.is_as_keyword
            and token.last_keyword_normalized != "WINDOW"
        ):
            # window clause also contains AS keyword, but it is not a query
            token.is_with_query_start = True
        elif (
            token.last_keyword_normalized == "TABLE"
            and token.find_nearest_token("(") is EmptyToken
        ):
            token.is_create_table_columns_declaration_start = True
        elif token.previous_token.normalized == "OVER":
            token.is_partition_clause_start = True
        else:
            # nested function
            token.is_nested_function_start = True
            self._nested_level += 1
            self._is_in_nested_function = True
        self._open_parentheses.append(token)
        self._parenthesis_level += 1

    def _determine_closing_parenthesis_type(self, token: SQLToken):
        """
        Determines the type of right parenthesis in query
        """
        last_open_parenthesis = self._open_parentheses.pop(-1)
        if last_open_parenthesis.is_subquery_start:
            token.is_subquery_end = True
            self._subquery_level -= 1
        elif last_open_parenthesis.is_column_definition_start:
            token.is_column_definition_end = True
        elif last_open_parenthesis.is_with_query_start:
            token.is_with_query_end = True
        elif last_open_parenthesis.is_create_table_columns_declaration_start:
            token.is_create_table_columns_declaration_end = True
        elif last_open_parenthesis.is_partition_clause_start:
            token.is_partition_clause_end = True
        else:
            token.is_nested_function_end = True
            self._nested_level -= 1
            if self._nested_level == 0:
                self._is_in_nested_function = False
        self._parenthesis_level -= 1

    def _find_column_for_with_column_alias(self, token: SQLToken) -> str:
        start_token = token.find_nearest_token(
            True, direction="right", value_attribute="is_with_query_start"
        )
        if start_token not in self._with_columns_candidates:
            end_token = start_token.find_nearest_token(
                True, direction="right", value_attribute="is_with_query_end"
            )
            columns = self._find_all_columns_between_tokens(
                start_token=start_token, end_token=end_token
            )
            self._with_columns_candidates[start_token] = columns
        if isinstance(self._with_columns_candidates[start_token], list):
            alias_of = self._with_columns_candidates[start_token].pop(0)
        else:
            alias_of = self._with_columns_candidates[start_token]
        return alias_of

    def _find_all_columns_between_tokens(
        self, start_token: SQLToken, end_token: SQLToken
    ) -> Union[str, List[str]]:
        """
        Returns a list of columns between two tokens
        """
        loop_token = start_token
        aliases = UniqueList()
        while loop_token.next_token != end_token:
            if loop_token.next_token.value in self._aliases_to_check:
                alias_token = loop_token.next_token
                if (
                    alias_token.normalized != "*"
                    or alias_token.is_wildcard_not_operator
                ):
                    aliases.append(self._resolve_alias_to_column(alias_token))
            loop_token = loop_token.next_token
        return aliases[0] if len(aliases) == 1 else aliases

    def _preprocess_query(self) -> str:
        """
        Perform initial query cleanup
        """
        if self._raw_query == "":
            return ""

        # python re does not have variable length look back/forward
        # so we need to replace all the " (double quote) for a
        # temporary placeholder as we DO NOT want to replace those
        # in the strings as this is something that user provided
        def replace_quotes_in_string(match):
            return re.sub('"', "<!!__QUOTE__!!>", match.group())

        def replace_back_quotes_in_string(match):
            return re.sub("<!!__QUOTE__!!>", '"', match.group())

        # unify quoting in queries, replace double quotes to backticks
        # it's best to keep the quotes as they can have keywords
        # or digits at the beginning so we only strip them in SQLToken
        # as double quotes are not properly handled in sqlparse
        query = re.sub(r"'.*?'", replace_quotes_in_string, self._raw_query)
        query = re.sub(r'"([^`]+?)"', r"`\1`", query)
        query = re.sub(r"'.*?'", replace_back_quotes_in_string, query)

        return query

    def _determine_last_relevant_keyword(self, token: SQLToken, last_keyword: str):
        if token.value == "," and token.last_keyword_normalized == "ON":
            return "FROM"
        if token.is_keyword and "".join(token.normalized.split()) in RELEVANT_KEYWORDS:
            if (
                not (
                    token.normalized == "FROM"
                    and token.get_nth_previous(3).normalized == "EXTRACT"
                )
                and not (
                    token.normalized == "ORDERBY"
                    and len(self._open_parentheses) > 0
                    and self._open_parentheses[-1].is_partition_clause_start
                )
                and not (token.normalized == "USING" and last_keyword == "SELECT")
            ):
                last_keyword = token.normalized
        return last_keyword

    def _is_token_part_of_complex_identifier(
        self, token: sqlparse.tokens.Token, index: int
    ) -> bool:
        """
        Checks if token is a part of complex identifier like
        <schema>.<table>.<column> or <table/sub_query>.<column>
        """
        return str(token) == "." or (
            index + 1 < self.tokens_length
            and str(self.non_empty_tokens[index + 1]) == "."
        )

    def _combine_qualified_names(self, index: int, token: SQLToken) -> None:
        """
        Combines names like <schema>.<table>.<column> or <table/sub_query>.<column>
        """
        value = token.value
        is_complex = True
        while is_complex:
            value, is_complex = self._combine_tokens(index=index, value=value)
            index = index - 2
        token.value = value

    def _combine_tokens(self, index: int, value: str) -> Tuple[str, bool]:
        """
        Checks if complex identifier is longer and follows back until it's finished
        """
        if index > 1 and str(self.non_empty_tokens[index - 1]) == ".":
            prev_value = self.non_empty_tokens[index - 2].value.strip("`").strip('"')
            value = f"{prev_value}.{value}"
            return value, True
        return value, False

    def _get_sqlparse_tokens(self, parsed) -> None:
        """
        Flattens the tokens and removes whitespace
        """
        self.sqlparse_tokens = parsed[0].tokens
        sqlparse_tokens = self._flatten_sqlparse()
        self.non_empty_tokens = [
            token
            for token in sqlparse_tokens
            if token.ttype is not Whitespace and token.ttype.parent is not Whitespace
        ]
        self.tokens_length = len(self.non_empty_tokens)

    def _flatten_sqlparse(self):
        for token in self.sqlparse_tokens:
            # sqlparse returns mysql digit starting identifiers as group
            # check https://github.com/andialbrecht/sqlparse/issues/337
            is_grouped_mysql_digit_name = (
                token.is_group
                and len(token.tokens) == 2
                and token.tokens[0].ttype is Number.Integer
                and (
                    token.tokens[1].is_group and token.tokens[1].tokens[0].ttype is Name
                )
            )
            if token.is_group and not is_grouped_mysql_digit_name:
                yield from token.flatten()
            elif is_grouped_mysql_digit_name:
                # we have digit starting name
                new_tok = Token(
                    value=f"{token.tokens[0].normalized}"
                    f"{token.tokens[1].tokens[0].normalized}",
                    ttype=token.tokens[1].tokens[0].ttype,
                )
                new_tok.parent = token.parent
                yield new_tok
                if len(token.tokens[1].tokens) > 1:
                    # unfortunately there might be nested groups
                    remaining_tokens = token.tokens[1].tokens[1:]
                    for tok in remaining_tokens:
                        if tok.is_group:
                            yield from tok.flatten()
                        else:
                            yield tok
            else:
                yield token
