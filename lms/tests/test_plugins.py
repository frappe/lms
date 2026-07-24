# Copyright (c) 2021, FOSS United and Contributors
# See license.txt
import unittest

from lms.plugins import embed_renderer, pdf_renderer


class TestPdfRenderers(unittest.TestCase):
	"""The server-rendered (non-SPA) PDF macros must stay usable on iOS Safari,
	which won't scroll a PDF inside an <iframe> — so both renderers surface an
	"Open PDF" link to the browser's native viewer alongside the inline frame."""

	def test_pdf_renderer_has_open_link_and_iframe(self):
		html = pdf_renderer("/files/a.pdf")
		self.assertIn('<a href="/files/a.pdf"', html)
		self.assertIn('target="_blank"', html)
		self.assertIn("<iframe", html)
		self.assertIn("/files/a.pdf#toolbar=0", html)

	def test_pdf_renderer_preserves_serve_resource_query(self):
		# Regression: the old quote(src) mangled the ?file_url= query, breaking
		# gated /private media URLs.
		src = "/api/method/lms...serve_resource?file_url=/private/files/a.pdf"
		html = pdf_renderer(src)
		self.assertIn("?file_url=/private/files/a.pdf", html)

	def test_embed_renderer_pdf_uses_the_open_link(self):
		html = embed_renderer("pdf|||/files/b.pdf")
		self.assertIn('<a href="/files/b.pdf"', html)
		self.assertIn("<iframe", html)

	def test_embed_renderer_non_pdf_is_a_plain_iframe(self):
		html = embed_renderer("youtube|||https://example.com/v")
		self.assertIn("<iframe", html)
		self.assertNotIn("Open PDF", html)
