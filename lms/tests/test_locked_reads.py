import threading
from contextlib import contextmanager
from unittest.mock import MagicMock, call, patch

import frappe
from frappe.tests import UnitTestCase
from frappe.utils import add_days, nowdate

from lms.install import ensure_course_progress_unique_constraint
from lms.lms.doctype.course_lesson import course_lesson
from lms.lms.doctype.course_lesson.course_lesson import save_progress
from lms.lms.doctype.lms_course_progress.lms_course_progress import LMSCourseProgress
from lms.lms.doctype.lms_enrollment.lms_enrollment import LMSEnrollment
from lms.lms.enrollment_constraints import ensure_enrollment_unique_constraints
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import create_enrollment, enroll_in_course

THREAD_TIMEOUT = 60
MEMBER_TABLES = (
	"LMS Course Progress",
	"LMS Quiz Submission",
	"LMS Certificate Request",
	"LMS Batch Enrollment",
	"LMS Enrollment",
)


class TestLockedReadsConcurrency(BaseTestUtils):
	"""Two requests on their own connections, each with a snapshot older than the other's
	commit. The workers commit, so this class skips BaseTestUtils' savepoint and deletes
	what it made in tearDown."""

	def setUp(self):
		super(BaseTestUtils, self).setUp()
		self.hash = frappe.generate_hash(length=6)
		self.created = []
		self.members = []
		self.instructor = self._user("instr", ["Course Creator", "Moderator"])

	def tearDown(self):
		frappe.db.rollback()
		for doctype in MEMBER_TABLES:
			frappe.db.delete(doctype, {"member": ("in", self.members)})
		for doctype, name in reversed(self.created):
			# nosemgrep: lms-unjustified-ignore-permissions - test teardown of fixtures this test committed
			frappe.delete_doc(doctype, name, force=True, ignore_permissions=True, ignore_on_trash=True)
		frappe.db.commit()  # nosemgrep
		super(BaseTestUtils, self).tearDown()

	def test_seat_limit_holds_under_concurrent_enrolments(self):
		"""Regression from #1880: the seat count read a stale snapshot after the batch lock.
		Added for audit finding #43."""
		batch = self._batch(self._course(), seat_count=1)
		members = [self._member(), self._member()]

		errors = self._in_parallel(lambda member: create_enrollment(batch.name), members)

		self.assertEqual(frappe.db.count("LMS Batch Enrollment", {"batch": batch.name}), 1)
		self.assertEqual(len(errors), 1, errors)
		self.assertIn("no seats available", str(errors[0][1]))

	def test_concurrent_enrolments_in_two_limited_batches_both_succeed(self):
		"""The locking count must not trade overbooking for deadlocks between batches whose rows
		sit next to each other in the index. Guard for the audit finding #43 fix."""
		course = self._course()
		batches = [self._batch(course, seat_count=5), self._batch(course, seat_count=5)]
		members = [self._member(), self._member()]

		errors = self._in_parallel(
			lambda member: create_enrollment(batches[members.index(member)].name), members
		)

		self.assertEqual(errors, [])

	def test_concurrent_double_batch_enrolment_is_a_no_op(self):
		"""Regression from #2664: the loser's insert hit the unique index and failed.
		Added for audit finding #44."""
		batch = self._batch(self._course())
		member = self._member()

		errors = self._in_parallel(_quietly(lambda _: create_enrollment(batch.name)), [member, member])

		self.assertEqual(errors, [])
		self.assertEqual(frappe.db.count("LMS Batch Enrollment", {"batch": batch.name}), 1)

	def test_a_repeated_payment_callback_is_a_no_op(self):
		"""Review finding c4: the loser of two callbacks hit the unique index, and the
		learner who had paid saw its "must be unique" message."""
		self.assertEqual(self._parallel_payment_callbacks(), (1, []))

	def test_a_repeated_payment_callback_is_a_no_op_without_the_unique_index(self):
		"""Review finding c4: on upgraded sites the recount's plain ValidationError
		escaped the callers' except UniqueValidationError and failed the callback."""
		with self._without_unique_index("LMS Enrollment", "unique_course_member"):
			self.assertEqual(self._parallel_payment_callbacks(), (1, []))

	def test_course_enrolment_stays_single_without_the_unique_index(self):
		"""Regression from #2664: on upgraded sites without the index, a stale check let both in.
		Added for audit finding #44."""
		course = self._course()
		member = self._member()

		with self._without_unique_index("LMS Enrollment", "unique_course_member"):
			errors = self._in_parallel(lambda _: self._enrol(course.name), [member, member])
			count = frappe.db.count("LMS Enrollment", {"course": course.name, "member": member})

		self.assertEqual(count, 1)
		self.assertEqual(len(errors), 1, errors)

	def test_batch_enrolment_stays_single_without_the_unique_index(self):
		"""Regression from #2664, as above, for batch enrolments.
		Added for audit finding #44."""
		batch = self._batch([])
		member = self._member()

		with self._without_unique_index("LMS Batch Enrollment", "unique_batch_member"):
			errors = self._in_parallel(_quietly(lambda _: create_enrollment(batch.name)), [member, member])
			count = frappe.db.count("LMS Batch Enrollment", {"batch": batch.name, "member": member})

		self.assertEqual(count, 1)
		self.assertEqual(errors, [])

	def test_batches_sharing_courses_in_opposite_order_do_not_deadlock(self):
		"""Regression from #2664: shared courses were locked in each batch's own order.
		Added for audit finding #47."""
		first, second = self._course(), self._course()
		batches = [self._batch([first, second]), self._batch([second, first])]
		members = [self._member(), self._member()]
		self._order_batch_courses(batches[0], [first, second])
		self._order_batch_courses(batches[1], [second, first])

		rendezvous = threading.Barrier(2)
		real_after_insert = LMSEnrollment.after_insert

		def after_insert(doc):
			real_after_insert(doc)
			if not getattr(frappe.local, "lms_rendezvous_done", False):
				frappe.local.lms_rendezvous_done = True
				try:
					rendezvous.wait(timeout=5)
				except threading.BrokenBarrierError:
					pass

		with patch.object(LMSEnrollment, "after_insert", after_insert):
			errors = self._in_parallel(
				lambda member: create_enrollment(batches[members.index(member)].name), members
			)

		self.assertEqual(errors, [])

	def test_an_evaluation_slot_cannot_be_double_booked(self):
		"""Regression from #706: the slot check was an unlocked check-then-insert.
		Added for audit finding #45."""
		course = self._course()
		evaluator = self._evaluator()
		frappe.db.set_value("LMS Course", course.name, "evaluator", evaluator)
		members = [self._member(), self._member()]
		for member in members:
			self._create_enrollment(member, course.name)
		slot_date = add_days(nowdate(), 30)

		errors = self._in_parallel(
			lambda member: self._book(course.name, evaluator, member, slot_date), members
		)

		booked = frappe.db.count(
			"LMS Certificate Request", {"evaluator": evaluator, "date": slot_date, "status": "Upcoming"}
		)
		self.assertEqual(booked, 1)
		self.assertEqual(len(errors), 1, errors)
		self.assertIn("already booked", str(errors[0][1]))

	def test_concurrent_lesson_completions_count_every_lesson(self):
		"""Regression as old as the app (#316): progress was recounted from a snapshot.
		Added for audit finding #46."""
		course, lessons = self._course_with_lessons(2)
		member = self._member()
		self._enrol_committed(course.name, member)

		errors = self._in_parallel(lambda lesson: save_progress(lesson, course.name), lessons, member)

		self.assertEqual(errors, [])
		progress = frappe.db.get_value(
			"LMS Enrollment", {"course": course.name, "member": member}, "progress"
		)
		self.assertEqual(progress, 100)

	def test_different_members_complete_lessons_concurrently(self):
		"""Guard for the audit finding #46 fix: the member-scoped lock must not deadlock two learners."""
		course, lessons = self._course_with_lessons(1)
		members = [self._member(), self._member()]
		for member in members:
			self._enrol_committed(course.name, member)

		errors = self._in_parallel(lambda member: save_progress(lessons[0], course.name), members)

		self.assertEqual(errors, [])
		for member in members:
			progress = frappe.db.get_value(
				"LMS Enrollment", {"course": course.name, "member": member}, "progress"
			)
			self.assertEqual(progress, 100)

	def _in_parallel(self, work, items, user=None) -> list:
		"""Run work(item) once per item on its own connection, as `user` or as the
		item itself. Each worker reads before the barrier, so its snapshot predates
		the other's commit. Returns [(item, exception)] for the workers that failed."""
		site = frappe.local.site
		frappe.db.commit()  # nosemgrep
		barrier = threading.Barrier(len(items))
		errors = []

		def run(item):
			try:
				frappe.init(site=site)
				frappe.connect()
				try:
					frappe.set_user(user or item)
					frappe.db.sql("select name from `tabLMS Enrollment` limit 1")
					barrier.wait(timeout=THREAD_TIMEOUT)
					work(item)
					frappe.db.commit()  # nosemgrep
				except Exception as e:
					frappe.db.rollback()
					errors.append((item, e))
				finally:
					frappe.destroy()
			except Exception as e:
				errors.append((item, e))
				barrier.abort()

		threads = [threading.Thread(target=run, args=(item,)) for item in items]
		for thread in threads:
			thread.start()
		for thread in threads:
			thread.join(timeout=THREAD_TIMEOUT)
			self.assertFalse(thread.is_alive(), "a worker did not finish")
		frappe.db.rollback()
		return errors

	@contextmanager
	def _without_unique_index(self, doctype, index):
		frappe.db.sql_ddl(f"alter table `tab{doctype}` drop index `{index}`")
		try:
			yield
		finally:
			for table in MEMBER_TABLES:
				frappe.db.delete(table, {"member": ("in", self.members)})
			frappe.db.commit()  # nosemgrep
			ensure_enrollment_unique_constraints()

	def _user(self, prefix, roles):
		user = self._create_user(f"lr-{prefix}-{self.hash}@example.com", "Locked", prefix.title(), roles)
		self.created.append(("User", user.name))
		return user.name

	def _member(self):
		member = self._user(f"m{len(self.members)}", ["LMS Student"])
		self.members.append(member)
		return member

	def _course(self):
		course = self._create_course(
			title=f"Locked Reads {self.hash} {frappe.generate_hash(length=4)}", instructor=self.instructor
		)
		self.created.append(("LMS Course", course.name))
		return course

	def _course_with_lessons(self, count):
		course = self._course()
		chapter = self._create_chapter(f"Chapter {self.hash}", course.name)
		self.created.append(("Course Chapter", chapter.name))
		course.reload()
		course.append("chapters", {"chapter": chapter.name})
		course.save()
		lessons = []
		for index in range(count):
			lesson = self._create_lesson(f"Lesson {index} {self.hash}", chapter.name, course.name)
			self.created.append(("Course Lesson", lesson.name))
			chapter.reload()
			chapter.append("lessons", {"lesson": lesson.name})
			chapter.save()
			lessons.append(lesson.name)
		return course, lessons

	def _batch(self, courses, seat_count=0):
		courses = courses if isinstance(courses, list) else [courses]
		batch = frappe.get_doc(
			{
				"doctype": "LMS Batch",
				"title": f"Locked Reads {self.hash} {frappe.generate_hash(length=4)}",
				"start_date": nowdate(),
				"end_date": add_days(nowdate(), 10),
				"start_time": "09:00:00",
				"end_time": "11:00:00",
				"timezone": "Asia/Kolkata",
				"published": 1,
				"allow_self_enrollment": 1,
				"seat_count": seat_count,
				"description": "Locked reads batch",
				"batch_details": "Locked reads batch",
				"instructors": [{"instructor": self.instructor}],
				"courses": [{"course": course.name} for course in courses],
			}
		).insert()
		self.created.append(("LMS Batch", batch.name))
		return batch

	def _order_batch_courses(self, batch, courses):
		"""get_all returns child rows newest first, so the first course is the newest."""
		for offset, course in enumerate(courses):
			stamp = frappe.utils.add_to_date(None, minutes=-offset)
			frappe.db.set_value(
				"Batch Course",
				{"parent": batch.name, "course": course.name},
				{"creation": stamp, "modified": stamp},
				update_modified=False,
			)

	def _evaluator(self):
		evaluator = self._user("eval", ["Batch Evaluator"])
		self._create_evaluator(evaluator)
		self.created.append(("Course Evaluator", evaluator))
		return evaluator

	def _book(self, course, evaluator, member, slot_date):
		frappe.get_doc(
			{
				"doctype": "LMS Certificate Request",
				"course": course,
				"member": member,
				"evaluator": evaluator,
				"date": slot_date,
				"start_time": "10:00:00",
				"end_time": "11:00:00",
			}
		).insert()

	def _parallel_payment_callbacks(self):
		"""Two callbacks for one paid enrolment at once: (enrolments made, errors)."""
		course = self._course()
		member = self._member()
		# nosemgrep: lms-unjustified-ignore-permissions - test fixture seeding, not the permission under test
		payment = frappe.get_doc(
			{
				"doctype": "LMS Payment",
				"member": member,
				"billing_name": "Locked Reads",
				"amount": 100,
				"currency": "INR",
				"payment_for_document_type": "LMS Course",
				"payment_for_document": course.name,
				"payment_received": 1,
			}
		).insert(ignore_permissions=True, ignore_mandatory=True)
		self.created.append(("LMS Payment", payment.name))

		errors = self._in_parallel(
			_quietly(lambda m: enroll_in_course(course.name, payment.name, m)), [member, member]
		)
		return frappe.db.count("LMS Enrollment", {"course": course.name, "member": member}), errors

	def _enrol(self, course):
		frappe.get_doc(
			{"doctype": "LMS Enrollment", "course": course, "member": frappe.session.user}
		).insert()

	def _enrol_committed(self, course, member):
		self._create_enrollment(member, course)
		frappe.db.commit()  # nosemgrep


class TestCourseProgressLockOrder(BaseTestUtils):
	def test_a_progress_row_locks_its_enrolment_before_it_is_written(self):
		"""Review finding c5: on_update and after_delete locked the progress row, then the
		enrolment; _save_progress takes them the other way round."""
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Course Creator", "Moderator"])
		course = self._create_course(title=f"Lock Order {frappe.generate_hash(length=6)}")
		chapter = self._create_chapter("Lock Order Chapter", course.name)
		lesson = self._create_lesson("Lock Order Lesson", chapter.name, course.name)
		student = self._create_user("lock-order@example.com", "Lock", "Order", ["LMS Student"])
		self._create_enrollment(student.name, course.name)

		log = []
		real_get_value = frappe.db.get_value
		real_insert, real_delete = LMSCourseProgress.db_insert, frappe.db.delete

		def get_value(*args, **kwargs):
			if kwargs.get("for_update") and args:
				log.append(("lock", args[0]))
			return real_get_value(*args, **kwargs)

		def db_insert(doc, *args, **kwargs):
			log.append(("write", doc.doctype))
			return real_insert(doc, *args, **kwargs)

		def delete(doctype, *args, **kwargs):
			if doctype == "LMS Course Progress":
				log.append(("write", doctype))
			return real_delete(doctype, *args, **kwargs)

		with (
			patch.object(frappe.db, "get_value", get_value),
			patch.object(frappe.db, "delete", delete),
			patch.object(LMSCourseProgress, "db_insert", db_insert),
		):
			progress = self._create_progress(student.name, course.name, lesson.name)
			inserted, log[:] = list(log), []
			progress.delete()
			deleted = list(log)

		for case, events in (("insert", inserted), ("delete", deleted)):
			with self.subTest(case=case):
				self.assertLess(
					events.index(("lock", "LMS Enrollment")), events.index(("write", "LMS Course Progress"))
				)


class TestRecountJobCommitsPerLearner(UnitTestCase):
	def test_each_learner_is_committed_before_the_next(self):
		"""Review finding c2: the job recounted every learner in one transaction, holding
		each enrolment's lock until the last was done."""
		events = MagicMock()
		with (
			patch.object(course_lesson, "recalculate_course_progress", events.recount),
			patch.object(frappe.db, "commit", events.commit),
		):
			course_lesson.recalculate_progress("course", ["a@example.com", "b@example.com"])

		self.assertEqual(
			events.mock_calls,
			[
				call.recount("course", "a@example.com"),
				call.commit(),
				call.recount("course", "b@example.com"),
				call.commit(),
			],
		)


class TestCourseProgressUniqueOnInstall(UnitTestCase):
	def test_fresh_installs_get_the_index_the_dedupe_patch_adds(self):
		"""Regression from #2411: only that patch added the index, and fresh installs skip it.
		Added for audit finding #42. Mocked: the shared site has
		duplicates the index would refuse."""
		with patch.object(frappe.db, "add_unique") as add_unique:
			ensure_course_progress_unique_constraint()
		add_unique.assert_called_once_with("LMS Course Progress", ["member", "lesson"])


class TestSlotBookingLock(BaseTestUtils):
	def test_a_booking_locks_the_course_evaluator_not_the_user(self):
		"""Review finding D3: the User row is written by every request the evaluator makes."""
		evaluator = self._create_user("slot-lock@example.com", "Slot", "Lock", ["Batch Evaluator"])
		self._create_evaluator(evaluator.name)
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Course Creator", "Moderator"])
		course = self._create_course(title=f"Slot Lock {frappe.generate_hash(length=6)}")
		frappe.db.set_value("LMS Course", course.name, "evaluator", evaluator.name)
		student = self._create_user("slot-lock-student@example.com", "Slot", "Student", ["LMS Student"])
		self._create_enrollment(student.name, course.name)

		locked = []
		real_get_value = frappe.db.get_value

		def get_value(*args, **kwargs):
			if kwargs.get("for_update") and args:
				locked.append(args[0])
			return real_get_value(*args, **kwargs)

		with patch.object(frappe.db, "get_value", get_value):
			# nosemgrep: lms-unjustified-ignore-permissions - the lock, not the role check, is under test
			frappe.get_doc(
				{
					"doctype": "LMS Certificate Request",
					"course": course.name,
					"member": student.name,
					"date": add_days(nowdate(), 30),
					"start_time": "10:00:00",
					"end_time": "11:00:00",
				}
			).insert(ignore_permissions=True)

		self.assertIn("Course Evaluator", locked)
		self.assertNotIn("User", locked)


def _quietly(work):
	"""work, failing if it left a message for the user: a no-op must not warn."""

	def run(item):
		work(item)
		if frappe.local.message_log:
			raise AssertionError(frappe.local.message_log)

	return run
