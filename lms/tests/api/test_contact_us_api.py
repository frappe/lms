# Copyright (c) 2026, Frappe and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.email.email_body import replace_filename_with_cid
from frappe.exceptions import FrappeTypeError

from lms.lms.api import send_contact_us_email
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import attach_file_to_doc, has_message, prepare_inline_images

CONTACT_ADDRESS = "support@example.com"
PNG = b"\x89PNG\r\n\x1a\n"


class ContactUsTestCase(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.sender = self._create_user(
			f"contact.sender.{frappe.generate_hash(length=8)}@example.com",
			"Contact",
			"Sender",
			["LMS Student"],
		)
		self.other = self._create_user(
			f"contact.other.{frappe.generate_hash(length=8)}@example.com",
			"Contact",
			"Other",
			["LMS Student"],
		)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _file(self, owner, file_name=None, content=PNG, is_private=1):
		frappe.set_user(owner)
		doc = frappe.new_doc("File")
		doc.file_name = file_name or f"probe-{frappe.generate_hash(length=8)}.png"
		doc.is_private = is_private
		doc.content = content
		doc.save(ignore_permissions=True)
		self.cleanup_items.append(("File", doc.name))
		frappe.set_user("Administrator")
		return doc


class TestHasMessage(BaseTestUtils):
	def test_an_image_on_its_own_is_a_message(self):
		# strip_html leaves nothing behind for a pasted screenshot, which is the
		# single most common contact-us body.
		self.assertTrue(has_message('<img src="/private/files/shot.png">'))
		self.assertTrue(has_message('<p><img src="/private/files/shot.png"></p>'))

	def test_text_is_a_message(self):
		self.assertTrue(has_message("<p>the player will not load</p>"))

	def test_an_empty_body_is_not_a_message(self):
		for body in (None, "", "<p></p>", "<p><br></p>", "<p>&nbsp;</p>", "<p>\xa0</p>"):
			with self.subTest(body=body):
				self.assertFalse(has_message(body))


class TestPrepareInlineImages(ContactUsTestCase):
	"""An image only reaches the recipient if the mail carries its bytes."""

	def test_a_private_file_the_sender_owns_becomes_an_embed(self):
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		body, images = prepare_inline_images(f'<p>hi</p><img src="{file.file_url}">')

		self.assertIn(f'embed="{file.file_url}"', body)
		self.assertNotIn("src=", body)
		self.assertEqual(images, [{"filename": file.file_url, "filecontent": PNG}])

	def test_a_public_file_the_sender_owns_becomes_an_embed(self):
		file = self._file(self.sender.name, is_private=0)
		frappe.set_user(self.sender.name)

		body, images = prepare_inline_images(f'<img src="{file.file_url}">')
		self.assertIn(f'embed="{file.file_url}"', body)
		self.assertEqual(len(images), 1)

	def test_a_file_the_sender_cannot_read_keeps_its_src(self):
		file = self._file(self.other.name)
		frappe.set_user(self.sender.name)

		body, images = prepare_inline_images(f'<img src="{file.file_url}">')
		self.assertIn(f'src="{file.file_url}"', body)
		self.assertNotIn("embed=", body)
		self.assertEqual(images, [])

	def test_a_case_variant_path_cannot_reach_another_users_file(self):
		"""tabFile.file_url is utf8mb4_unicode_ci and the filesystem is not.

		Matching the caller's string in the database and then handing that same
		string to frappe to open is what made this reachable: a row the sender
		owns satisfies the lookup while the path resolves to someone else's
		file. The row has to decide both the URL and the bytes.
		"""
		stem = frappe.generate_hash(length=8)
		secret = PNG + b"VICTIM-SECRET"
		# The sender's row is written first so the victim's is the newer one, and
		# get_all hands it back first. Ordered the other way the sender's row
		# comes out on top and the test passes even with no permission check.
		mine = self._file(self.sender.name, file_name=f"OFFER-{stem}.png", content=PNG + b"MINE")
		victim = self._file(self.other.name, file_name=f"offer-{stem}.png", content=secret)
		self.assertNotEqual(victim.file_url, mine.file_url)

		# The premise: one lookup on the victim's path returns both rows. Without
		# this the test could pass by matching nothing at all.
		matched = frappe.get_all("File", filters={"file_url": victim.file_url}, pluck="name")
		self.assertIn(victim.name, matched)
		self.assertIn(mine.name, matched)

		frappe.set_user(self.sender.name)
		body, images = prepare_inline_images(f'<img src="{victim.file_url}">')

		self.assertNotIn(secret, [image["filecontent"] for image in images])
		self.assertNotIn(victim.file_url, body)
		self.assertEqual(images, [{"filename": mine.file_url, "filecontent": PNG + b"MINE"}])
		self.assertIn(f'embed="{mine.file_url}"', body)

	def test_an_external_image_is_left_alone(self):
		frappe.set_user(self.sender.name)
		body, images = prepare_inline_images('<img src="https://example.com/cat.png">')
		self.assertIn('src="https://example.com/cat.png"', body)
		self.assertEqual(images, [])

	def test_empty_content_stays_empty(self):
		self.assertEqual(prepare_inline_images(""), ("", []))
		self.assertEqual(prepare_inline_images(None), ("", []))

	def test_comments_are_dropped(self):
		frappe.set_user(self.sender.name)
		body, _images = prepare_inline_images("<p>a</p><!-- mso conditional --><p>b</p>")
		self.assertNotIn("mso conditional", body)

	@patch("lms.lms.utils.MAX_INLINE_IMAGES", 1)
	def test_more_images_than_the_cap_are_refused(self):
		first = self._file(self.sender.name)
		second = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		with self.assertRaises(frappe.ValidationError):
			prepare_inline_images(f'<img src="{first.file_url}"><img src="{second.file_url}">')

	@patch("lms.lms.utils.MAX_INLINE_IMAGE_BYTES", 4)
	def test_images_over_the_byte_cap_are_refused(self):
		# as_dict builds the whole MIME string inside the request, so an
		# unbounded payload is a request-time cost, not a queue one.
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		with self.assertRaises(frappe.ValidationError):
			prepare_inline_images(f'<img src="{file.file_url}">')

	@patch("lms.lms.utils.MAX_INLINE_IMAGE_BYTES", 4)
	def test_the_byte_cap_is_checked_before_reading_the_file(self):
		# file.file_size alone already exceeds the cap here, so get_content
		# (which loads the whole file into memory) should never run.
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		with patch("frappe.core.doctype.file.file.File.get_content") as get_content:
			with self.assertRaises(frappe.ValidationError):
				prepare_inline_images(f'<img src="{file.file_url}">')
			get_content.assert_not_called()

	def test_one_query_resolves_every_image_in_the_message(self):
		# get_readable_files takes every src at once; the loop over tags in
		# prepare_inline_images must not call frappe.get_all again per tag.
		first = self._file(self.sender.name)
		second = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		with patch("frappe.get_all", wraps=frappe.get_all) as get_all:
			_body, images = prepare_inline_images(
				f'<img src="{first.file_url}"><img src="{second.file_url}">'
			)

		self.assertEqual(len(images), 2)
		file_lookups = [call for call in get_all.call_args_list if call.args and call.args[0] == "File"]
		self.assertEqual(len(file_lookups), 1)

	def test_a_matched_file_is_fetched_only_once(self):
		# has_permission(doc=name) fetches the row itself internally
		# (frappe.get_lazy_doc, invisible to a frappe.get_doc patch); passing
		# the already-fetched doc instead drops one "select * from tabFile
		# where name = " round trip per matched image.
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)
		real_sql = frappe.db.sql
		file_selects = []

		def counting_sql(*args, **kwargs):
			query = args[0] if args else kwargs.get("query", "")
			if "tabFile" in query and "where `name`" in query.lower():
				file_selects.append(query)
			return real_sql(*args, **kwargs)

		with patch("frappe.db.sql", side_effect=counting_sql):
			_body, images = prepare_inline_images(f'<img src="{file.file_url}">')

		self.assertEqual(len(images), 1)
		self.assertEqual(len(file_selects), 1)


class TestSendContactUsEmail(ContactUsTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.previous_contact = frappe.db.get_single_value("LMS Settings", "contact_us_email")

	@classmethod
	def tearDownClass(cls):
		frappe.db.set_single_value("LMS Settings", "contact_us_email", cls.previous_contact)
		super().tearDownClass()

	def setUp(self):
		super().setUp()
		frappe.db.set_single_value("LMS Settings", "contact_us_email", CONTACT_ADDRESS)

	def _send(self, subject, content):
		with patch("frappe.sendmail") as sendmail:
			name = send_contact_us_email(subject, content)
		self.cleanup_items.append(("Communication", name))
		return name, sendmail.call_args.kwargs

	def test_the_recipient_comes_from_settings_not_the_caller(self):
		frappe.set_user(self.sender.name)
		_name, sent = self._send("Broken video", "<p>The player will not load.</p>")
		self.assertEqual(sent["recipients"], [CONTACT_ADDRESS])

	def test_an_image_on_its_own_can_be_sent(self):
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		_name, sent = self._send("Broken video", f'<img src="{file.file_url}">')
		self.assertIn(f'embed="{file.file_url}"', sent["content"])
		self.assertEqual(sent["inline_images"], [{"filename": file.file_url, "filecontent": PNG}])

	def test_the_outgoing_copy_embeds_the_image_and_the_stored_one_keeps_its_url(self):
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)
		content = f'<p>see this</p><img src="{file.file_url}">'

		name, sent = self._send("Broken video", content)

		self.assertIn(f'embed="{file.file_url}"', sent["content"])
		self.assertEqual(frappe.db.get_value("Communication", name, "content"), content)

	def test_the_embedded_file_is_attached_so_the_record_still_renders(self):
		# File.has_permission grants a private file to its owner or to whoever
		# can read the doc it hangs off. An editor upload hangs off nothing.
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		name, _sent = self._send("Broken video", f'<img src="{file.file_url}">')
		self.assertTrue(
			frappe.db.exists(
				"File",
				{
					"file_url": file.file_url,
					"attached_to_doctype": "Communication",
					"attached_to_name": name,
				},
			)
		)

	def test_the_mail_carries_the_sanitized_copy(self):
		frappe.set_user(self.sender.name)
		_name, sent = self._send(
			"Broken video", '<p>hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'
		)
		self.assertNotIn("<script>", sent["content"])
		self.assertNotIn("javascript:", sent["content"])

	def test_the_communication_can_be_replied_to(self):
		frappe.set_user(self.sender.name)
		name, sent = self._send("Broken video", "<p>hi</p>")

		message_id = frappe.db.get_value("Communication", name, "message_id")
		self.assertTrue(message_id)
		self.assertEqual(sent["message_id"], message_id)

	def test_the_communication_records_the_sender_and_recipient(self):
		frappe.set_user(self.sender.name)
		name, _sent = self._send("Broken video", "<p>hi</p>")

		communication = frappe.db.get_value(
			"Communication", name, ["sender", "recipients", "subject"], as_dict=1
		)
		self.assertEqual(communication.sender, self.sender.name)
		self.assertEqual(communication.recipients, CONTACT_ADDRESS)
		self.assertEqual(communication.subject, "Broken video")

	def test_an_unset_contact_address_is_reported(self):
		frappe.db.set_single_value("LMS Settings", "contact_us_email", "")
		frappe.set_user(self.sender.name)
		with self.assertRaises(frappe.ValidationError):
			send_contact_us_email("Broken video", "<p>hi</p>")

	def test_a_blank_subject_is_rejected(self):
		frappe.set_user(self.sender.name)
		with self.assertRaises(frappe.ValidationError):
			send_contact_us_email("   ", "<p>hi</p>")

	def test_a_message_with_neither_words_nor_images_is_rejected(self):
		frappe.set_user(self.sender.name)
		with self.assertRaises(frappe.ValidationError):
			send_contact_us_email("Broken video", "<p><br></p>")

	def test_a_guest_is_not_a_permitted_caller(self):
		# allow_guest is what frappe checks at dispatch, and it records the
		# function in frappe.guest_methods rather than tagging it.
		self.assertNotIn(send_contact_us_email, frappe.guest_methods)

	def test_non_string_arguments_are_rejected(self):
		frappe.set_user(self.sender.name)
		with self.assertRaises((frappe.ValidationError, FrappeTypeError)):
			send_contact_us_email(["Broken video"], "<p>hi</p>")


class TestAttachFileToDoc(ContactUsTestCase):
	def test_locks_the_target_row_before_checking_for_an_existing_attachment(self):
		# Without the lock, two concurrent callers can both see "no File row
		# yet" for the same (file_url, doctype, docname) and both insert one.
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)

		calls = []
		real_get_value = frappe.db.get_value

		def spy(*args, **kwargs):
			calls.append((args, kwargs))
			return real_get_value(*args, **kwargs)

		with patch("frappe.db.get_value", side_effect=spy):
			attach_file_to_doc(file.file_url, "User", self.sender.name)

		lock_calls = [c for c in calls if c[0][:2] == ("User", self.sender.name) and c[1].get("for_update")]
		self.assertEqual(len(lock_calls), 1)

		attached = frappe.db.get_value(
			"File",
			{"file_url": file.file_url, "attached_to_doctype": "User", "attached_to_name": self.sender.name},
		)
		self.cleanup_items.append(("File", attached))


class TestEmbedIsWhatFrappeInlines(ContactUsTestCase):
	"""Pins the frappe contract the fix rests on. replace_filename_with_cid
	*strips* an embed it cannot resolve, so if this ever stops holding the
	images vanish from the mail rather than raising anything."""

	def test_an_embed_becomes_a_content_id_and_carries_the_bytes(self):
		file = self._file(self.sender.name)
		frappe.set_user(self.sender.name)
		body, images = prepare_inline_images(f'<img src="{file.file_url}">')

		provided = {image["filename"]: image["filecontent"] for image in images}
		message, inline_images = replace_filename_with_cid(body, provided)

		self.assertEqual(len(inline_images), 1)
		self.assertEqual(inline_images[0]["filecontent"], PNG)
		self.assertIn(f'src="cid:{inline_images[0]["content_id"]}"', message)
		self.assertNotIn(file.file_url, message)
