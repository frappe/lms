"""
Module for parsing sql queries and returning columns,
tables, names of with statements etc.
"""

# pylint:disable=unsubscriptable-object
from sql_metadata.parser import Parser
from sql_metadata.keywords_lists import QueryType

__all__ = ["Parser", "QueryType"]
