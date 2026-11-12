import frappe

from lms.lms import home
from lms.lms.test_helpers import BaseTestUtils


class TestHome(BaseTestUtils):
	"""The home page's server side: where Continue goes, what an instructor made and what a new
	learner can start."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.instructor = cls._create_user(
			"home-instructor@example.com", "Home", "Instructor", ["Course Creator"]
		).name
		cls.learner = cls._create_user("home-learner@example.com", "Home", "Learner", ["LMS Student"]).name
		cls.newcomer = cls._create_user("home-newcomer@example.com", "Home", "Newcomer", ["LMS Student"]).name

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		# Saved by Administrator, taught by the instructor, as a site's demo course is.
		self.course = self._create_course("Home Test Course", instructor=self.instructor).name
		first = self._create_chapter("Home First Chapter", self.course).name
		second = self._create_chapter("Home Second Chapter", self.course).name
		self._create_chapter_reference(self.course, first, idx=1)
		self._create_chapter_reference(self.course, second, idx=2)
		self.first_lesson = self._create_lesson("Home First Lesson", first, self.course).name
		self.second_lesson = self._create_lesson("Home Second Lesson", second, self.course).name
		self._create_lesson_reference(first, self.first_lesson)
		self._create_lesson_reference(second, self.second_lesson)

	def _spot(self, route):
		return route["name"], route["params"].get("chapterNumber"), route["params"].get("lessonNumber")

	def test_continue_starts_at_the_first_lesson(self):
		route = home._next_lesson_route(self.course, self.learner)
		self.assertEqual(self._spot(route), ("Lesson", 1, 1))

	def test_continue_skips_finished_lessons(self):
		self._create_progress(self.learner, self.course, self.first_lesson)
		route = home._next_lesson_route(self.course, self.learner)
		self.assertEqual(self._spot(route), ("Lesson", 2, 1))

	def test_continue_reopens_the_course_once_everything_is_done(self):
		self._create_progress(self.learner, self.course, self.first_lesson)
		self._create_progress(self.learner, self.course, self.second_lesson)
		route = home._next_lesson_route(self.course, self.learner)
		self.assertEqual(self._spot(route), ("Lesson", 1, 1))

	def test_continue_opens_the_course_page_when_it_has_no_lessons(self):
		empty = self._create_course("Home Empty Course", instructor=self.instructor).name
		route = home._next_lesson_route(empty, self.learner)
		self.assertEqual(route, {"name": "CourseDetail", "params": {"courseName": empty}})

	def test_learner_home_links_a_course_to_its_next_lesson(self):
		self._create_enrollment(self.learner, self.course)
		self._create_progress(self.learner, self.course, self.first_lesson)
		frappe.set_user(self.learner)
		row = next(item for item in home.my_learning_home() if item["type"] == "Course")
		self.assertEqual(self._spot(row["route"]), ("Lesson", 2, 1))

	def test_a_course_belongs_to_its_instructor_not_whoever_saved_it(self):
		frappe.set_user("Administrator")
		self.assertNotIn(self.course, [item["name"] for item in home.admin_home()["items"]])
		frappe.set_user(self.instructor)
		made = {item["name"]: item for item in home.admin_home()["items"]}
		self.assertIn(self.course, made)
		self.assertEqual(made[self.course]["type"], "Course")
		self.assertTrue(made[self.course]["published"])

	def test_the_demo_course_is_an_example_not_the_admins_work(self):
		from lms.lms.telemetry import DEMO_COURSE_TITLE

		demo_admin = self._create_user(
			"home-demo-admin@example.com", "Home", "Demo Admin", ["Course Creator"]
		).name
		demo = self._create_course(DEMO_COURSE_TITLE, instructor=demo_admin).name
		frappe.set_user(demo_admin)
		result = home.admin_home()
		# Teaching only the demo course still leaves them on the first-time home.
		self.assertEqual(result["items"], [])
		self.assertIsNone(result["resume"])
		self.assertEqual(result["example"]["name"], demo)
		self.assertEqual(result["example"]["route"]["params"]["courseName"], demo)

	def test_the_last_edited_draft_is_offered_to_continue(self):
		goal = frappe.get_doc({"doctype": "LMS Goal", "title": "Home Draft Skill"}).insert()
		# Skills are made by admins; the owner is who "Created by you" follows.
		goal.db_set("owner", self.instructor)
		frappe.set_user(self.instructor)
		resume = home.admin_home()["resume"]
		self.assertEqual(resume["name"], goal.name)
		self.assertFalse(resume["published"])

	def test_a_new_learner_sees_popular_courses_in_card_shape(self):
		frappe.set_user(self.newcomer)
		courses = home.discover_home()["courses"]
		card = next((course for course in courses if course["name"] == self.course), None)
		self.assertIsNotNone(card)
		# The course list card reads these.
		for key in ("title", "lessons", "enrollments", "instructors"):
			self.assertIn(key, card)

	def test_a_skill_open_to_everyone_can_be_joined(self):
		goal = self._open_skill(assign_everyone=1)
		frappe.set_user(self.newcomer)
		self.assertIn(goal, [skill["name"] for skill in home.discover_home()["skills"]])
		home.join_skill(goal)
		self.assertTrue(
			frappe.db.exists("LMS Goal Assignment", {"goal": goal, "member": self.newcomer, "is_preview": 0})
		)
		# Joined once, it leaves the list and a second join adds nothing.
		self.assertNotIn(goal, [skill["name"] for skill in home.discover_home()["skills"]])
		home.join_skill(goal)
		self.assertEqual(frappe.db.count("LMS Goal Assignment", {"goal": goal, "member": self.newcomer}), 1)

	def test_a_skill_for_named_people_cannot_be_joined(self):
		goal = self._open_skill(assign_everyone=0)
		frappe.set_user(self.newcomer)
		with self.assertRaises(frappe.PermissionError):
			home.join_skill(goal)

	def _open_skill(self, assign_everyone: int) -> str:
		frappe.set_user("Administrator")
		goal = frappe.get_doc(
			{
				"doctype": "LMS Goal",
				"title": f"Home Skill {assign_everyone}",
				"assign_everyone": assign_everyone,
			}
		).insert()
		goal.db_set("status", "Published")
		return goal.name


class TestLearnerSkills(BaseTestUtils):
	"""The learner's Skills list: open skills and their own, never another person's."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.learner = cls._create_user(
			"skills-learner@example.com", "Skills", "Learner", ["LMS Student"]
		).name
		cls.other = cls._create_user("skills-other@example.com", "Skills", "Other", ["LMS Student"]).name

	def _skill(self, title, assign_everyone=0, status="Published"):
		frappe.set_user("Administrator")
		goal = frappe.get_doc(
			{"doctype": "LMS Goal", "title": title, "assign_everyone": assign_everyone}
		).insert()
		goal.db_set("status", status)
		return goal.name

	def _give(self, goal, member):
		# nosemgrep: lms-unjustified-ignore-permissions - test setup
		frappe.get_doc({"doctype": "LMS Goal Assignment", "goal": goal, "member": member}).insert(
			ignore_permissions=True
		)

	def test_lists_open_and_own_skills_only(self):
		from lms.lms.ai.api import learner_skills

		open_skill = self._skill("Skills Open", assign_everyone=1)
		mine = self._skill("Skills Mine")
		theirs = self._skill("Skills Theirs")
		draft = self._skill("Skills Draft", assign_everyone=1, status="Draft")
		self._give(mine, self.learner)
		self._give(theirs, self.other)

		frappe.set_user(self.learner)
		rows = {row["name"]: row for row in learner_skills()}
		self.assertIn(open_skill, rows)
		self.assertIn(mine, rows)
		self.assertNotIn(theirs, rows)
		self.assertNotIn(draft, rows)
		self.assertTrue(rows[mine]["enrolled"])
		self.assertFalse(rows[open_skill]["enrolled"])
		self.assertEqual(rows[mine]["enrolled_count"], 1)

	def test_the_sidebar_shows_skills_only_when_there_are_some(self):
		from lms.lms.ai.api import has_learner_skills

		frappe.db.set_value("LMS Goal", {"assign_everyone": 1}, "assign_everyone", 0)
		self.assertFalse(has_learner_skills(self.learner))
		self._give(self._skill("Skills Given"), self.learner)
		self.assertTrue(has_learner_skills(self.learner))

	def test_an_open_skill_can_be_looked_at_before_starting(self):
		from lms.lms.ai.api import skill_overview

		open_skill = self._skill("Skills Overview Open", assign_everyone=1)
		theirs = self._skill("Skills Overview Theirs")
		self._give(theirs, self.other)

		frappe.set_user(self.learner)
		overview = skill_overview(open_skill)
		self.assertEqual(overview["name"], open_skill)
		self.assertFalse(overview["enrolled"])
		# Looking does not enrol.
		self.assertFalse(
			frappe.db.exists("LMS Goal Assignment", {"goal": open_skill, "member": self.learner})
		)
		with self.assertRaises(frappe.PermissionError):
			skill_overview(theirs)
