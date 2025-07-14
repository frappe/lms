"""
Module with various utils
"""

from typing import Any, List, Sequence


class UniqueList(list):
    """
    List that keeps it's items unique
    """

    def append(self, item: Any) -> None:
        if item not in self:
            super().append(item)

    def extend(self, items: Sequence[Any]) -> None:
        for item in items:
            self.append(item)

    def __sub__(self, other) -> List:
        return [x for x in self if x not in other]


def flatten_list(input_list: List) -> List[str]:
    """
    Flattens list of string and lists if there are nested lists.
    """
    result = []
    for item in input_list:
        if isinstance(item, list):
            result.extend(flatten_list(item))
        else:
            result.append(item)
    return result
