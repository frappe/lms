import json
from unittest.mock import patch

import frappe

from lms.lms.ai import course_material, material, transcripts
from lms.lms.ai.api import course_practice
from lms.lms.test_helpers import BaseTestUtils


def _fake_index(kb, title, text=None, file_url=None):
	"""Stands in for the embedding provider: records the lesson as read, as a finished source."""
	frappe.get_doc(
		{
			"doctype": material.SOURCE_DOCTYPE,
			"knowledge_base": kb.name,
			"title": title,
			"source_type": "Text",
			"content": text,
			"status": "Completed",
		}
	).db_insert()
	_fake_index.read.append(title)
	return True


_fake_index.read = []


class TestCourseMaterial(BaseTestUtils):
	"""A course as a skill's material: its lessons read in, kept in step, cited by lesson."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"practice-instructor@example.com", "Practice", "Instructor", ["Course Creator"]
		).name

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		_fake_index.read = []
		self.course = self._create_course("Practice Fire Safety", instructor=self.instructor).name
		first = self._create_chapter("Practice First Chapter", self.course).name
		second = self._create_chapter("Practice Second Chapter", self.course).name
		self._create_chapter_reference(self.course, first, idx=1)
		self._create_chapter_reference(self.course, second, idx=2)
		self.exits = self._create_lesson(
			"Fire exits", first, self.course, content=_editorjs("Use the nearest exit.")
		).name
		self.alarms = self._create_lesson(
			"Alarms", second, self.course, content=_editorjs("Pull the alarm first.")
		).name
		self._create_lesson_reference(first, self.exits)
		self._create_lesson_reference(second, self.alarms)
		self.goal = frappe.get_doc({"doctype": "LMS Goal", "title": "Practice Skill"}).insert().name
		# A knowledge base needs an embedding model to insert; the test reads nothing for real.
		kb = frappe.get_doc({"doctype": "Flow Knowledge Base", "title": f"Goal {self.goal}"})
		kb.name = kb.title
		kb.db_insert()
		frappe.db.set_value("LMS Goal", self.goal, "knowledge_base", kb.name)

	def _add(self):
		with patch.object(course_material, "enqueue_sync"):
			course_material.add_course(self.goal, self.course)
		with patch.object(material, "index_part", _fake_index):
			course_material.sync_course(self.goal, self.course)

	def test_lesson_text_keeps_words_and_drops_the_rest(self):
		content = json.dumps(
			{
				"blocks": [
					{"type": "header", "data": {"text": "Before you <b>leave</b>"}},
					{
						"type": "list",
						"data": {
							"items": [
								{"content": "Close doors", "items": [{"content": "Quietly", "items": []}]}
							]
						},
					},
					{"type": "upload", "data": {"file_url": "/files/drill.mp4"}},
					{"type": "quiz", "data": {"quiz": "q1"}},
				]
			}
		)
		frappe.db.set_value("Course Lesson", self.exits, "content", content)
		text = course_material.lesson_text(self.exits)
		self.assertIn("Before you leave", text)
		self.assertIn("- Close doors\n- Quietly", text)
		self.assertNotIn("drill.mp4", text)

	def test_every_lesson_is_read_and_cited_by_lesson(self):
		self._add()
		self.assertEqual(
			_fake_index.read, ["Practice Fire Safety · Fire exits", "Practice Fire Safety · Alarms"]
		)
		sources = material.goal_sources(self.goal)
		self.assertEqual(len(sources), 1)
		self.assertEqual(sources[0]["title"], "Practice Fire Safety")
		self.assertEqual(sources[0]["course"], self.course)
		self.assertEqual(sources[0]["pages"], 2)
		link = course_material.lesson_link(self.goal, "Practice Fire Safety · Alarms")
		self.assertTrue(link.endswith(f"/courses/{self.course}/learn/2-1"))

	def test_an_edit_rereads_only_the_lesson_that_changed(self):
		self._add()
		_fake_index.read = []
		frappe.db.set_value("Course Lesson", self.alarms, "content", _editorjs("Pull the alarm, then leave."))
		with patch.object(material, "index_part", _fake_index):
			course_material.sync_course(self.goal, self.course)
		self.assertEqual(_fake_index.read, ["Practice Fire Safety · Alarms"])

	def test_a_lesson_edit_queues_a_sync_for_skills_using_the_course(self):
		self._add()
		with patch.object(course_material, "enqueue_sync") as enqueue:
			frappe.get_doc("Course Lesson", self.exits).save()
		enqueue.assert_called_with(self.goal, self.course)

	def test_removing_the_course_forgets_its_lessons(self):
		self._add()
		material.remove_source(self.goal, "Practice Fire Safety")
		self.assertEqual(material.goal_sources(self.goal), [])
		self.assertFalse(frappe.get_doc("LMS Goal", self.goal).courses)

	def test_a_course_is_added_once(self):
		self._add()
		with self.assertRaises(frappe.ValidationError):
			course_material.add_course(self.goal, self.course)


class TestCoursePractice(BaseTestUtils):
	"""Practice on a course: a published skill open to everyone, offered after the course is done."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.learner = cls._create_user(
			"practice-learner@example.com", "Practice", "Learner", ["LMS Student"]
		).name

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self.course = self._create_course("Practice Course").name
		self.enrollment = self._create_enrollment(self.learner, self.course)

	def _skill(self, title, assign_everyone=1, status="Published"):
		goal = frappe.get_doc(
			{
				"doctype": "LMS Goal",
				"title": title,
				"assign_everyone": assign_everyone,
				"courses": [{"course": self.course, "document": "Practice Course", "lessons": "{}"}],
			}
		).insert()
		goal.db_set("status", status)
		return goal.name

	def _finish(self):
		frappe.db.set_value("LMS Enrollment", self.enrollment.name, "progress", 100)

	def test_nothing_is_offered_before_the_course_is_finished(self):
		self._skill("Practice Open")
		frappe.set_user(self.learner)
		self.assertEqual(course_practice(self.course), [])

	def test_only_published_skills_open_to_everyone_are_offered(self):
		open_skill = self._skill("Practice Open")
		named = self._skill("Practice Named", assign_everyone=0)
		draft = self._skill("Practice Draft", status="Draft")
		self._finish()
		frappe.set_user(self.learner)
		offered = [skill["name"] for skill in course_practice(self.course)]
		self.assertIn(open_skill, offered)
		self.assertNotIn(named, offered)
		self.assertNotIn(draft, offered)


def _editorjs(text: str) -> str:
	return json.dumps({"blocks": [{"type": "paragraph", "data": {"text": text}}]})


class TestTranscripts(BaseTestUtils):
	"""A video lesson becomes material: its captions when it has them, else what Whisper hears."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		frappe.db.delete(
			transcripts.TRANSCRIPT_DOCTYPE,
			{"name": ("in", ["youtube/dQw4w9WgXcQ", "youtube/abcdefghijk", "file//private/files/intro.mp4"])},
		)
		self.course = self._create_course("Transcript Course").name
		chapter = self._create_chapter("Transcript Chapter", self.course).name
		self._create_chapter_reference(self.course, chapter, idx=1)
		self.lesson = self._create_lesson(
			"Opening a sales invoice", chapter, self.course, content=_embed("dQw4w9WgXcQ")
		).name
		self._create_lesson_reference(chapter, self.lesson)

	def test_finds_the_video_in_every_way_a_lesson_can_hold_it(self):
		for value in (
			"dQw4w9WgXcQ",
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
			"https://youtu.be/dQw4w9WgXcQ",
			"https://www.youtube.com/embed/dQw4w9WgXcQ",
			"https://m.youtube.com/shorts/dQw4w9WgXcQ",
		):
			self.assertEqual(transcripts.youtube_id(value), "dQw4w9WgXcQ", value)
		self.assertIsNone(transcripts.youtube_id("https://vimeo.com/12345"))
		self.assertIsNone(transcripts.youtube_id("not a video"))
		found = transcripts.lesson_videos(_embed("dQw4w9WgXcQ"), "https://youtu.be/abcdefghijk")
		self.assertEqual([v.key for v in found], ["youtube/dQw4w9WgXcQ", "youtube/abcdefghijk"])

	def test_knows_every_video_service_a_lesson_can_embed(self):
		cases = {
			("vimeo", "https://vimeo.com/76979871"): "vimeo/76979871",
			("vimeo", "https://vimeo.com/76979871/abc123"): "vimeo/76979871:abc123",
			(
				"cloudflareStream",
				"https://customer-m033z5x00ks6nunl.cloudflarestream.com/b236bde30eb07b9d01318940e5fc3eda/watch",
			): "cloudflare/customer-m033z5x00ks6nunl.cloudflarestream.com/b236bde30eb07b9d01318940e5fc3eda",
			(
				"bunnyStream",
				"https://iframe.mediadelivery.net/play/239/8d0f0ad9-7e5a-4a21-a0a9-6a1e1c4d5f6d",
			): ("bunny/239/8d0f0ad9-7e5a-4a21-a0a9-6a1e1c4d5f6d"),
		}
		for (service, source), key in cases.items():
			self.assertEqual(transcripts.embedded_video(service, source).key, key, source)
		self.assertIsNone(transcripts.embedded_video("aparat", "https://www.aparat.com/v/abc"))
		upload = json.dumps(
			{
				"blocks": [
					{"type": "upload", "data": {"file_type": "mp4", "file_url": "/private/files/intro.mp4"}}
				]
			}
		)
		self.assertEqual(
			[v.key for v in transcripts.lesson_videos(upload, None)], ["file//private/files/intro.mp4"]
		)

	def test_reads_the_words_out_of_a_caption_file(self):
		vtt = (
			"WEBVTT\nKind: captions\nLanguage: en\n\n1\n00:00:00.000 --> 00:00:02.000\nOpen the <b>Selling</b> workspace.\n\n"
			"2\n00:00:02.000 --> 00:00:04.000\nOpen the Selling workspace.\n\n3\n00:00:04.000 --> 00:00:06.000\n[Music]\nClick New."
		)
		self.assertEqual(transcripts.vtt_text(vtt), "Open the Selling workspace. Click New.")

	def test_the_video_is_read_once_and_taught_from(self):
		reading = transcripts.Reading(
			text="Click New, pick the customer.", method="Captions", language="en", generated=True
		)
		with patch.object(transcripts, "_captions", return_value=reading) as captions:
			text = course_material.lesson_text(self.lesson)
			course_material.lesson_text(self.lesson)
		self.assertIn("What the video says:\nClick New, pick the customer.", text)
		captions.assert_called_once()
		row = frappe.db.get_value(
			transcripts.TRANSCRIPT_DOCTYPE,
			"youtube/dQw4w9WgXcQ",
			["status", "method", "is_generated"],
			as_dict=True,
		)
		self.assertEqual((row.status, row.method, row.is_generated), ("Ready", "Captions", 1))
		self.assertEqual(course_material.unread_videos(self.lesson), 0)

	def test_a_video_nobody_can_read_is_counted_not_tried_again(self):
		with patch.object(transcripts, "_captions", return_value=transcripts.Reading()) as captions:
			self.assertEqual(course_material.lesson_text(self.lesson), "")
			course_material.lesson_text(self.lesson)
		captions.assert_called_once()
		self.assertEqual(course_material.unread_videos(self.lesson), 1)
		self.assertEqual(
			frappe.db.get_value(transcripts.TRANSCRIPT_DOCTYPE, "youtube/dQw4w9WgXcQ", "error"),
			"This video has no captions.",
		)

	def test_an_uploaded_video_is_listened_to_with_the_course_as_a_hint(self):
		frappe.db.set_value(
			"Course Lesson",
			self.lesson,
			"content",
			json.dumps(
				{
					"blocks": [
						{
							"type": "upload",
							"data": {"file_type": "mp4", "file_url": "/private/files/intro.mp4"},
						}
					]
				}
			),
		)
		heard = transcripts.Reading(
			text="Submit posts the invoice.", method="Speech", language="en", generated=True
		)
		with (
			patch.object(transcripts, "_media_url", return_value="/tmp/intro.mp4"),
			patch.object(transcripts, "_speech", return_value=heard) as speech,
		):
			text = course_material.lesson_text(self.lesson)
		self.assertIn("Submit posts the invoice.", text)
		speech.assert_called_once_with("/tmp/intro.mp4", "Transcript Course: Opening a sales invoice")
		self.assertEqual(
			frappe.db.get_value(transcripts.TRANSCRIPT_DOCTYPE, "file//private/files/intro.mp4", "method"),
			"Speech",
		)

	def test_a_caption_in_the_wrong_script_is_rewritten_once_the_model_is_back(self):
		hindi = transcripts.Reading(text="हाई आई एम जन्नत", method="Captions", language="hi", generated=True)
		with (
			patch.object(transcripts, "_captions", return_value=hindi),
			patch.object(transcripts, "_english", return_value=None),
		):
			self.assertIn("हाई आई एम जन्नत", course_material.lesson_text(self.lesson))
		with patch.object(transcripts, "_english", return_value="Hi, I am Jannat") as english:
			self.assertIn("Hi, I am Jannat", course_material.lesson_text(self.lesson))
			course_material.lesson_text(self.lesson)
		english.assert_called_once()
		row = frappe.db.get_value(
			transcripts.TRANSCRIPT_DOCTYPE,
			"youtube/dQw4w9WgXcQ",
			["language", "source_language"],
			as_dict=True,
		)
		self.assertEqual((row.language, row.source_language), ("en", "hi"))

	def test_the_material_panel_says_which_videos_stayed_silent(self):
		goal = frappe.get_doc({"doctype": "LMS Goal", "title": "Transcript Skill"}).insert().name
		kb = frappe.get_doc({"doctype": "Flow Knowledge Base", "title": f"Goal {goal}"})
		kb.name = kb.title
		kb.db_insert()
		frappe.db.set_value("LMS Goal", goal, "knowledge_base", kb.name)
		with patch.object(course_material, "enqueue_sync"):
			course_material.add_course(goal, self.course)
		with (
			patch.object(material, "index_part", _fake_index),
			patch.object(transcripts, "_captions", return_value=transcripts.Reading()),
		):
			course_material.sync_course(goal, self.course)
		source = material.goal_sources(goal)[0]
		self.assertTrue(source["empty"])
		self.assertEqual(source["videos_unread"], 1)


def _embed(video: str) -> str:
	return json.dumps(
		{
			"blocks": [
				{
					"type": "embed",
					"data": {
						"service": "youtube",
						"source": f"https://www.youtube.com/watch?v={video}",
						"embed": video,
					},
				}
			]
		}
	)


class TestVoiceServer(BaseTestUtils):
	"""Talking to our own voice server: found by its address, trusted by its token."""

	def test_the_token_travels_with_every_request(self):
		from lms.lms.ai import tts

		frappe.conf.lms_local_tts_url = "https://voice.example.test/"
		frappe.conf.lms_voice_token = "secret"
		try:
			self.assertEqual(transcripts.speech_service(), "local")
			with patch("requests.post") as post:
				post.return_value.json.return_value = {"text": "heard"}
				self.assertEqual(transcripts.transcribe_audio("local", b"audio", "ERPNext"), "heard")
			self.assertEqual(post.call_args.args[0], "https://voice.example.test/stt")
			self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer secret")
			self.assertEqual(tts.voice_server_headers(), {"Authorization": "Bearer secret"})
		finally:
			frappe.conf.pop("lms_local_tts_url", None)
			frappe.conf.pop("lms_voice_token", None)
		self.assertEqual(tts.voice_server_headers(), {})
