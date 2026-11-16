"""rewrite_private_media routes private lesson media through serve_resource.

Lesson content saved by Python's json.dumps stores non-Latin letters as \\uXXXX escapes.
Those escapes used to stop the URL pattern, so a video with a Cyrillic file name reached
the browser as a raw /private/files/ URL, which LMS students may not open.
"""

import json
import unittest

from lms.lms.utils import LESSON_PRIVATE_MEDIA_ENDPOINT, rewrite_private_media

CYRILLIC_URL = "/private/files/Төлбөрийн код.mp4"


def _lesson(file_url):
	return {"blocks": [{"type": "upload", "data": {"file_url": file_url, "file_type": "MP4"}}]}


def _served_url(content):
	return json.loads(rewrite_private_media(content))["blocks"][0]["data"]["file_url"]


class TestRewritePrivateMedia(unittest.TestCase):
	def test_escaped_cyrillic_file_name_is_served_through_the_endpoint(self):
		content = json.dumps(_lesson(CYRILLIC_URL))
		self.assertIn("\\u", content)  # the stored shape that used to slip through
		self.assertTrue(_served_url(content).startswith(LESSON_PRIVATE_MEDIA_ENDPOINT))

	def test_plain_cyrillic_file_name_is_served_through_the_endpoint(self):
		content = json.dumps(_lesson(CYRILLIC_URL), ensure_ascii=False)
		self.assertTrue(_served_url(content).startswith(LESSON_PRIVATE_MEDIA_ENDPOINT))

	def test_latin_file_name_is_served_through_the_endpoint(self):
		content = json.dumps(_lesson("/private/files/intro.mp4"))
		self.assertEqual(_served_url(content), LESSON_PRIVATE_MEDIA_ENDPOINT + "/private/files/intro.mp4")

	def test_html_content_is_rewritten_without_json_handling(self):
		html = '<video src="/private/files/intro.mp4"></video>'
		self.assertEqual(
			rewrite_private_media(html),
			f'<video src="{LESSON_PRIVATE_MEDIA_ENDPOINT}/private/files/intro.mp4"></video>',
		)

	def test_content_that_only_looks_like_json_is_left_as_is(self):
		broken = '{"file_url": "/private/files/\\u0422' + "unterminated"
		self.assertEqual(rewrite_private_media(broken), broken)
