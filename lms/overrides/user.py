import hashlib
import frappe
import requests
from frappe import _
from frappe.core.doctype.user.user import User
from frappe.utils import cint, escape_html, random_string
from frappe.website.utils import is_signup_disabled
from lms.lms.utils import get_average_rating
from frappe.website.utils import cleanup_page_name
from frappe.model.naming import append_number_if_name_exists
from lms.widgets import Widgets


class CustomUser(User):
	def validate(self):
		super().validate()
		self.validate_username_duplicates()
		self.validate_completion()

	def validate_username_duplicates(self):
		while not self.username or self.username_exists():
			self.username = append_number_if_name_exists(
				self.doctype, cleanup_page_name(self.full_name), fieldname="username"
			)
		if " " in self.username:
			self.username = self.username.replace(" ", "")

		if len(self.username) < 4:
			self.username = self.email.replace("@", "").replace(".", "")

	def validate_skills(self):
		unique_skills = []
		for skill in self.skill:
			if not skill.skill_name:
				return
			if not skill.skill_name in unique_skills:
				unique_skills.append(skill.skill_name)
			else:
				frappe.throw(_("Skills must be unique"))

	def validate_completion(self):
		if frappe.db.get_single_value("LMS Settings", "force_profile_completion"):
			all_fields_have_value = True
			profile_mandatory_fields = frappe.get_hooks("profile_mandatory_fields")
			docfields = frappe.get_meta(self.doctype).fields

			for field in profile_mandatory_fields:
				if not self.get(field):
					all_fields_have_value = False
					break

			self.profile_complete = all_fields_have_value

	def get_batch_count(self) -> int:
		"""Returns the number of batches authored by this user."""
		return frappe.db.count(
			"LMS Enrollment", {"member": self.name, "member_type": "Mentor"}
		)

	def get_user_reviews(self):
		"""Returns the reviews created by user"""
		return frappe.get_all("LMS Course Review", {"owner": self.name})

	def get_mentored_courses(self):
		"""Returns all courses mentored by this user"""
		mentored_courses = []
		mapping = frappe.get_all(
			"LMS Course Mentor Mapping",
			{
				"mentor": self.name,
			},
			["name", "course"],
		)

		for map in mapping:
			if frappe.db.get_value("LMS Course", map.course, "published"):
				course = frappe.db.get_value(
					"LMS Course",
					map.course,
					["name", "upcoming", "title", "image", "enable_certification"],
					as_dict=True,
				)
				mentored_courses.append(course)

		return mentored_courses


def get_enrolled_courses():
	in_progress = []
	completed = []
	memberships = get_course_membership(None, member_type="Student")

	for membership in memberships:
		course = frappe.db.get_value(
			"LMS Course",
			membership.course,
			[
				"name",
				"upcoming",
				"title",
				"short_introduction",
				"image",
				"enable_certification",
				"paid_course",
				"course_price",
				"currency",
				"published",
				"creation",
			],
			as_dict=True,
		)
		if not course.published:
			continue
		course.enrollment_count = frappe.db.count(
			"LMS Enrollment", {"course": course.name, "member_type": "Student"}
		)
		course.avg_rating = get_average_rating(course.name) or 0
		progress = cint(membership.progress)
		if progress < 100:
			in_progress.append(course)
		else:
			completed.append(course)

	in_progress.sort(key=lambda x: x.enrollment_count, reverse=True)
	completed.sort(key=lambda x: x.enrollment_count, reverse=True)

	return {"in_progress": in_progress, "completed": completed}


def get_course_membership(member=None, member_type=None):
	"""Returns all memberships of the user."""

	filters = {"member": member or frappe.session.user}
	if member_type:
		filters["member_type"] = member_type

	return frappe.get_all("LMS Enrollment", filters, ["name", "course", "progress"])


def get_authored_courses(member=None, only_published=True):
	"""Returns the number of courses authored by this user."""
	course_details = []
	courses = frappe.get_all(
		"Course Instructor", {"instructor": member or frappe.session.user}, ["parent"]
	)

	for course in courses:
		detail = frappe.db.get_value(
			"LMS Course",
			course.parent,
			[
				"name",
				"upcoming",
				"title",
				"short_introduction",
				"image",
				"paid_course",
				"course_price",
				"currency",
				"status",
				"published",
				"creation",
			],
			as_dict=True,
		)

		if only_published and detail and not detail.published:
			continue
		detail.enrollment_count = frappe.db.count(
			"LMS Enrollment", {"course": detail.name, "member_type": "Student"}
		)
		detail.avg_rating = get_average_rating(detail.name) or 0
		course_details.append(detail)

	course_details.sort(key=lambda x: x.enrollment_count, reverse=True)
	return course_details


def get_palette(full_name):
	"""
	Returns a color unique to each member for Avatar"""

	palette = [
		["--orange-avatar-bg", "--orange-avatar-color"],
		["--pink-avatar-bg", "--pink-avatar-color"],
		["--blue-avatar-bg", "--blue-avatar-color"],
		["--green-avatar-bg", "--green-avatar-color"],
		["--dark-green-avatar-bg", "--dark-green-avatar-color"],
		["--red-avatar-bg", "--red-avatar-color"],
		["--yellow-avatar-bg", "--yellow-avatar-color"],
		["--purple-avatar-bg", "--purple-avatar-color"],
		["--gray-avatar-bg", "--gray-avatar-color0"],
	]

	encoded_name = str(full_name).encode("utf-8")
	hash_name = hashlib.md5(encoded_name).hexdigest()
	idx = cint((int(hash_name[4:6], 16) + 1) / 5.33)
	return palette[idx % 8]


@frappe.whitelist(allow_guest=True)
def sign_up(email, full_name, verify_terms, user_category):
	if is_signup_disabled():
		frappe.throw(_("Sign Up is disabled"), _("Not Allowed"))

	user = frappe.db.get("User", {"email": email})
	if user:
		if user.enabled:
			return 0, _("Already Registered")
		else:
			return 0, _("Registered but disabled")
	else:
		if frappe.db.get_creation_count("User", 60) > 300:
			frappe.respond_as_web_page(
				_("Temporarily Disabled"),
				_(
					"Too many users signed up recently, so the registration is disabled. Please try back in an hour"
				),
				http_status_code=429,
			)

	user = frappe.get_doc(
		{
			"doctype": "User",
			"email": email,
			"first_name": escape_html(full_name),
			"verify_terms": verify_terms,
			"user_category": user_category,
			"country": "",
			"enabled": 1,
			"new_password": random_string(10),
			"user_type": "Website User",
		}
	)
	user.flags.ignore_permissions = True
	user.flags.ignore_password_policy = True
	user.insert()

	# set default signup role as per Portal Settings
	default_role = frappe.db.get_value("Portal Settings", None, "default_role")
	if default_role:
		user.add_roles(default_role)

	user.add_roles("LMS Student")
	set_country_from_ip(None, user.name)

	if user.flags.email_sent:
		return 1, _("Please check your email for verification")
	else:
		return 2, _("Please ask your administrator to verify your sign-up")


def set_country_from_ip(login_manager=None, user=None):
	if not user and login_manager:
		user = login_manager.user
	user_country = frappe.db.get_value("User", user, "country")
	# if user_country:
	#    return
	frappe.db.set_value("User", user, "country", get_country_code())
	return


def get_country_code():
	ip = frappe.local.request_ip
	res = requests.get(f"http://ip-api.com/json/{ip}")

	try:
		data = res.json()
		if data.get("status") != "fail":
			return frappe.db.get_value("Country", {"code": data.get("countryCode")}, "name")
	except Exception:
		pass
	return


def on_session_creation(login_manager):
	if frappe.db.get_single_value(
		"System Settings", "setup_complete"
	) and frappe.db.get_single_value("LMS Settings", "default_home"):
		frappe.local.response["home_page"] = "/courses"


@frappe.whitelist()
def search_users(start: int = 0, text: str = ""):
	start = cint(start)
	search_text = frappe.db.escape(f"%{text}%")

	or_filters = get_or_filters(search_text)
	count = len(get_users(or_filters, 0, 900000000))
	users = get_users(or_filters, start, 24)
	user_details = get_user_details(users)

	return {"user_details": user_details, "start": start + 24, "count": count}


def get_or_filters(text):
	user_fields = [
		"first_name",
		"last_name",
		"full_name",
		"email",
		"preferred_location",
		"dream_companies",
	]
	education_fields = ["institution_name", "location", "degree_type", "major"]
	work_fields = ["title", "company"]
	certification_fields = ["certification_name", "organization"]

	or_filters = []
	if text:
		for field in user_fields:
			or_filters.append(f"u.{field} like {text}")
		for field in education_fields:
			or_filters.append(f"ed.{field} like {text}")
		for field in work_fields:
			or_filters.append(f"we.{field} like {text}")
		for field in certification_fields:
			or_filters.append(f"c.{field} like {text}")

		or_filters.append(f"s.skill_name like {text}")
		or_filters.append(f"pf.function like {text}")
		or_filters.append(f"pi.industry like {text}")

	return "AND ({})".format(" OR ".join(or_filters)) if or_filters else ""


def get_user_details(users):
	user_details = []
	for user in users:
		details = frappe.db.get_value(
			"User",
			user,
			["name", "username", "full_name", "user_image", "headline", "looking_for_job"],
			as_dict=True,
		)
		user_details.append(Widgets().MemberCard(member=details, avatar_class="avatar-large"))

	return user_details


def get_users(or_filters, start, page_length):
	users = frappe.db.sql(
		"""
        SELECT DISTINCT u.name
        FROM `tabUser` u
        LEFT JOIN `tabEducation Detail` ed
        ON u.name = ed.parent
        LEFT JOIN `tabWork Experience` we
        ON u.name = we.parent
        LEFT JOIN `tabCertification` c
        ON u.name = c.parent
        LEFT JOIN `tabSkills` s
        ON u.name = s.parent
        LEFT JOIN `tabPreferred Function` pf
        ON u.name = pf.parent
        LEFT JOIN `tabPreferred Industry` pi
        ON u.name = pi.parent
        WHERE u.enabled = True {or_filters}
        ORDER BY u.creation desc
        LIMIT {start}, {page_length}
	""".format(
			or_filters=or_filters, start=start, page_length=page_length
		),
		as_dict=1,
	)

	return users


@frappe.whitelist()
def save_role(user, role, value):
	if cint(value):
		doc = frappe.get_doc(
			{
				"doctype": "Has Role",
				"parent": user,
				"role": role,
				"parenttype": "User",
				"parentfield": "roles",
			}
		)
		doc.save(ignore_permissions=True)
	else:
		frappe.db.delete("Has Role", {"parent": user, "role": role})
	return True
