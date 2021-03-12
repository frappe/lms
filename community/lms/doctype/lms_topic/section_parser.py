"""Utility to split the text in the topic into multiple sections.
"""
from __future__ import annotations
from dataclasses import dataclass
import re
from typing import List, Tuple, Dict, Iterator

RE_SECTION = re.compile(r"^\{\{\s(\w+)\s*(?:\((.*)\))?\s*\}\}\s*")
class SectionParser:
    def parse(self, text: str) -> Iterator[Section]:
        """Parses given text into sections and return an iterator over sections.
        """
        lines = text.splitlines()
        marked_lines = self.parse_lines(lines)
        return self.group_sections(marked_lines)

    def parse_lines(self, lines: List[str]) -> List[Tuple[str, str, str]]:
        for line in lines:
            m = RE_SECTION.match(line)
            if m:
                yield m.group(1), self.parse_attrs(m.group(2)), None
            else:
                yield None, None, line

    def parse_attrs(self, attrs_str: str) -> Dict[str, str]:
        # XXX-Anand: Hack
        code = "dict({})".format(attrs_str or "")
        return eval(code)

    def group_sections(self, marked_lines) -> Iterator[Section]:
        index = 0

        def make_section(type='text', id=None, label=None, **attrs):
            nonlocal index
            index += 1

            id = id or f"section-{index}"
            label = label or id
            return Section(
                type=type,
                id=id,
                label=label,
                attrs=attrs)

        section = make_section("text")

        for mark, attrs, line in marked_lines:
            if not mark:
                section.append(line)
                continue

            yield section

            if mark == 'end':
                section = make_section(type='text')
            else:
                section = make_section(**attrs)

        yield section

@dataclass
class Section:
    """One section of the Topic.
    """
    type: str
    id: str
    label: str
    contents: str = ""
    attrs: dict = None

    def append(self, line):
        if not line.endswith("\n"):
            line = line + "\n"
        self.contents += line

    def __repr__(self):
        attrs = dict(type=self.type, id=self.id, label=self.label, **self.attrs)
        attrs_str = ", ".join(f'{k}="{v}"' for k, v in attrs.items())
        return f'<Section({attrs_str})>'
