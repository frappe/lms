"""
Module used to produce generalized sql out of given query
"""

import re
import sqlparse


class Generalizator:
    """
    Class used to produce generalized sql out of given query
    """

    def __init__(self, sql: str = ""):
        self._raw_query = sql

    # SQL queries normalization (#16)
    @staticmethod
    def _normalize_likes(sql: str) -> str:
        """
        Normalize and wrap LIKE statements

        :type sql str
        :rtype: str
        """
        sql = sql.replace("%", "")

        # LIKE '%bot'
        sql = re.sub(r"LIKE '[^\']+'", "LIKE X", sql)

        # or all_groups LIKE X or all_groups LIKE X
        matches = re.finditer(r"(or|and) [^\s]+ LIKE X", sql, flags=re.IGNORECASE)
        matches = [match.group(0) for match in matches] if matches else None

        if matches:
            for match in set(matches):
                sql = re.sub(
                    r"(\s?" + re.escape(match) + ")+", " " + match + " ...", sql
                )

        return sql

    @property
    def without_comments(self) -> str:
        """
        Removes comments from SQL query

        :rtype: str
        """
        sql = sqlparse.format(self._raw_query, strip_comments=True)
        sql = sql.replace("\n", " ")
        sql = re.sub(r"[ \t]+", " ", sql)
        return sql

    @property
    def generalize(self) -> str:
        """
        Removes most variables from an SQL query
        and replaces them with X or N for numbers.

        Based on Mediawiki's DatabaseBase::generalizeSQL
        """
        if self._raw_query == "":
            return ""

        # MW comments
        # e.g. /* CategoryDataService::getMostVisited N.N.N.N */
        sql = self.without_comments
        sql = sql.replace('"', "")

        # multiple spaces
        sql = re.sub(r"\s{2,}", " ", sql)

        # handle LIKE statements
        sql = self._normalize_likes(sql)

        sql = re.sub(r"\\\\", "", sql)
        sql = re.sub(r"\\'", "", sql)
        sql = re.sub(r'\\"', "", sql)
        sql = re.sub(r"'[^\']*'", "X", sql)
        sql = re.sub(r'"[^\"]*"', "X", sql)

        # All newlines, tabs, etc replaced by single space
        sql = re.sub(r"\s+", " ", sql)

        # All numbers => N
        sql = re.sub(r"-?[0-9]+", "N", sql)

        # WHERE foo IN ('880987','882618','708228','522330')
        sql = re.sub(
            r" (IN|VALUES)\s*\([^,]+,[^)]+\)", " \\1 (XYZ)", sql, flags=re.IGNORECASE
        )

        return sql.strip()
