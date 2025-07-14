# -*- coding: utf-8 -*-

from .pdfkit import PDFKit
from .pdfkit import Configuration


def from_url(url, output_path=None, options=None, toc=None, cover=None,
             configuration=None, cover_first=False, verbose=False):
    """
    Convert file of files from URLs to PDF document

    :param url: URL or list of URLs to be saved
    :param output_path: (optional) path to output PDF file. By default, PDF will be returned for assigning to a variable.
    :param options: (optional) dict with wkhtmltopdf global and page options, with or w/o '--'
    :param toc: (optional) dict with toc-specific wkhtmltopdf options, with or w/o '--'
    :param cover: (optional) string with url/filename with a cover html page
    :param configuration: (optional) instance of pdfkit.configuration.Configuration()
    :param cover_first: (optional) if True, cover always precedes TOC
    :param verbose: (optional) By default '--quiet' is passed to all calls, set this to False to get wkhtmltopdf output to stdout.

    Returns: True on success
    """

    r = PDFKit(url, 'url', options=options, toc=toc, cover=cover,
               configuration=configuration, cover_first=cover_first, verbose=verbose)

    return r.to_pdf(output_path)


def from_file(input, output_path=None, options=None, toc=None, cover=None, css=None,
              configuration=None, cover_first=False, verbose=False):
    """
    Convert HTML file or files to PDF document

    :param input: path to HTML file or list with paths or file-like object
    :param output_path: (optional) path to output PDF file. By default, PDF will be returned for assigning to a variable.
    :param options: (optional) dict with wkhtmltopdf options, with or w/o '--'
    :param toc: (optional) dict with toc-specific wkhtmltopdf options, with or w/o '--'
    :param cover: (optional) string with url/filename with a cover html page
    :param css: (optional) string with path to css file which will be added to a single input file
    :param configuration: (optional) instance of pdfkit.configuration.Configuration()
    :param cover_first: (optional) if True, cover always precedes TOC
    :param verbose: (optional) By default '--quiet' is passed to all calls, set this to False to get wkhtmltopdf output to stdout.

    Returns: True on success
    """

    r = PDFKit(input, 'file', options=options, toc=toc, cover=cover, css=css,
               configuration=configuration, cover_first=cover_first, verbose=verbose)

    return r.to_pdf(output_path)


def from_string(input, output_path=None, options=None, toc=None, cover=None, css=None,
                configuration=None, cover_first=False, verbose=False):
    """
    Convert given string or strings to PDF document

    :param input: string with a desired text. Could be a raw text or a html file
    :param output_path: (optional) path to output PDF file. By default, PDF will be returned for assigning to a variable.
    :param options: (optional) dict with wkhtmltopdf options, with or w/o '--'
    :param toc: (optional) dict with toc-specific wkhtmltopdf options, with or w/o '--'
    :param cover: (optional) string with url/filename with a cover html page
    :param css: (optional) string with path to css file which will be added to a input string
    :param configuration: (optional) instance of pdfkit.configuration.Configuration()
    :param cover_first: (optional) if True, cover always precedes TOC
    :param verbose: (optional) By default '--quiet' is passed to all calls, set this to False to get wkhtmltopdf output to stdout.

    Returns: True on success
    """

    r = PDFKit(input, 'string', options=options, toc=toc, cover=cover, css=css,
               configuration=configuration, cover_first=cover_first, verbose=verbose)

    return r.to_pdf(output_path)


def configuration(**kwargs):
    """
    Constructs and returns a :class:`Configuration` with given options

    :param wkhtmltopdf: path to binary
    :param meta_tag_prefix: the prefix for ``pdfkit`` specific meta tags
    """

    return Configuration(**kwargs)
