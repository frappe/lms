Bleach allowlist
================

A curated list of tags, attributes, and styles suitable for filtering
user-provided HTML using `bleach <http://bleach.readthedocs.org/en/latest/>`_.

Currently, it consists of basic set of tags suitable for rendering markdown,
and markup intended for printing, as well as a list of all CSS styles.  Please
send pull requests with improvements or lists of tags and attributes for other
purposes (wikis, comments, etc?).

Installation
------------
::

    pip install bleach-allowlist

Use
---
::

    import bleach
    from bleach_allowlist import print_tags, print_attrs, all_styles

    bleach.clean(raw_html, print_tags, print_attrs, all_styles)

Properties:

- ``markdown_tags``: Safe HTML tags needed to render markdown-style markup.
- ``markdown_attrs``: Safe attributes tags needed to render markdown-style markup.
- ``print_tags``: Safe HTML tags suitable for printing / PDFs.
- ``print_attrs``: Safe attributes suitable for printing / PDFs.
- ``all_styles``: A list of all CSS properties supported by major browsers.
- ``standard_styles``: A list of standard (non-vendor-specific) CSS properaties.

See `bleach_allowlist.py <https://github.com/yourcelf/bleach-allowlist/blob/main/bleach_allowlist/bleach_allowlist.py>`_ for more.

Have improvements or lists of tags suitable for other purposes?  Please send a
pull request!  Let's build a few good task-specific allow-lists rather than
reinventing these lists every time.


