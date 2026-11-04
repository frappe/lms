"""
The md module extends markdown to add macros.

Macros can be added to the markdown text in the following format.

    {{ MacroName("macro-argument") }}

These macros will be rendered using a pluggable mechanism.

Apps can provide a hook lms_markdown_macro_renderers, a
dictionary mapping the macro name to the function that to render
that macro. The function will get the argument passed to the macro
as argument.
"""

import html as HTML
import re

import frappe
from frappe.utils import md_to_html


def markdown_to_html(text):
	"""Renders markdown text into html, with macros rendered in place."""
	macros = []

	def stash(match):
		macros.append(match)
		return _macro_placeholder(len(macros) - 1)

	html = md_to_html(re.sub(MACRO_RE, stash, text or "")) or ""

	# macros inside code are examples, so they stay as literal text
	def restore_literal(code):
		code = code.group(0)
		for index, macro in enumerate(macros):
			code = code.replace(_macro_placeholder(index), HTML.escape(macro.group(0), quote=False))
		return code

	html = re.sub(r"<(pre|code)\b.*?</\1>", restore_literal, html, flags=re.DOTALL)
	for index, macro in enumerate(macros):
		placeholder = _macro_placeholder(index)
		if placeholder in html:
			html = html.replace(placeholder, _render_macro_block(macro.group(1), macro.group(2)))
	return html


def _macro_placeholder(index):
	# letters and digits only, so markdown passes it through untouched
	return f"lmsmacroplaceholder{index}x"


def _render_macro_block(macro_name, macro_argument):
	classname = "lesson-video" if macro_name == "YouTubeVideo" else ""
	return f"<div class='{classname}'>{render_macro(macro_name, macro_argument)}</div>"


def find_macros(text):
	"""Returns all macros in the given text.

	>>> find_macros(text)
	[
	    ('YouTubeVideo': 'abcd1234')
	    ('Exercise', 'two-circles'),
	    ('Exercise', 'four-circles')
	]
	"""
	if not text:
		return []
	macros = re.findall(MACRO_RE, text)
	# remove the quotes around the argument
	return [(name, _remove_quotes(arg)) for name, arg in macros]


def _remove_quotes(value):
	"""Removes quotes around a value.

	Also strips the whitespace.

	    >>> _remove_quotes('"hello"')
	    'hello'
	    >>> _remove_quotes("'hello'")
	    'hello'
	    >>> _remove_quotes("hello")
	    'hello'
	"""
	return value.strip(" '\"")


def get_macro_registry():
	d = frappe.get_hooks("lms_markdown_macro_renderers") or {}
	return {name: frappe.get_attr(klass[0]) for name, klass in d.items()}


def render_macro(macro_name, macro_argument):
	# stripping the quotes on either side of the argument
	macro_argument = _remove_quotes(macro_argument)

	registry = get_macro_registry()
	if macro_name in registry:
		return registry[macro_name](macro_argument)
	else:
		return f"<p>Unknown macro: {macro_name}</p>"


MACRO_RE = r"{{ *(\w+)\(([^{}]*)\) *}}"
