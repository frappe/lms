"""Testcases for cssutils.css.DOMImplementation"""

import xml.dom
import xml.dom.minidom
import warnings

import cssutils


class TestDOMImplementation:
    def setup(self):
        self.domimpl = cssutils.DOMImplementationCSS()

    def test_createCSSStyleSheet(self):
        "DOMImplementationCSS.createCSSStyleSheet()"
        title, media = 'Test Title', cssutils.stylesheets.MediaList('all')
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            sheet = self.domimpl.createCSSStyleSheet(title, media)
        assert isinstance(sheet, cssutils.css.CSSStyleSheet)
        assert title == sheet.title
        assert media == sheet.media

    def test_createDocument(self):
        "DOMImplementationCSS.createDocument()"
        doc = self.domimpl.createDocument(None, None, None)
        assert isinstance(doc, xml.dom.minidom.Document)

    def test_createDocumentType(self):
        "DOMImplementationCSS.createDocumentType()"
        doctype = self.domimpl.createDocumentType('foo', 'bar', 'raboof')
        assert isinstance(doctype, xml.dom.minidom.DocumentType)

    def test_hasFeature(self):
        "DOMImplementationCSS.hasFeature()"
        tests = [
            ('css', '1.0'),
            ('css', '2.0'),
            ('stylesheets', '1.0'),
            ('stylesheets', '2.0'),
        ]
        for name, version in tests:
            assert self.domimpl.hasFeature(name, version)
