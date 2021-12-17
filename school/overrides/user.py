import frappe
from frappe.core.doctype.user.user import User
from frappe.utils import cint, escape_html, random_string
import hashlib
import random
import re
from frappe import _
from frappe.website.utils import is_signup_disabled
import requests
from frappe.geo.country_info import get_all

class CustomUser(User):

    def validate(self):
        super(CustomUser, self).validate()
        self.validate_username_characters()
        self.validate_skills()

    def validate_username_characters(self):
        if len(self.username):
            underscore_condition = self.username[0] == "_" or self.username[-1] == "_"
        else:
            underscore_condition = ''

        regex = re.compile('[@!#$%^&*()<>?/\|}{~:-]')

        if self.is_new():
            if not self.username:
                self.username = self.get_username_from_first_name()

            if self.username.find(" "):
                self.username.replace(" ", "")

            if regex.search(self.username) or underscore_condition:
                self.username = self.remove_illegal_characters()

            if len(self.username) < 4:
                self.username = self.email.replace("@", "").replace(".", "")

            while self.username_exists():
                self.username = self.remove_illegal_characters() + str(random.randint(0, 99))

        else:
            if not self.username:
                frappe.throw(_("Username already exists."))

            if regex.search(self.username):
                frappe.throw(_("Username can only contain alphabets, numbers and underscore."))

            if underscore_condition:
                frappe.throw(_("First and Last character of username cannot be Underscore(_)."))

            if len(self.username) < 4:
                frappe.throw(_("Username cannot be less than 4 characters"))

    def validate_skills(self):
        unique_skills = []
        for skill in self.skill:
            if not skill.skill_name:
                return
            if not skill.skill_name in unique_skills:
                unique_skills.append(skill.skill_name)
            else:
                frappe.throw(_("Skills must be unique"))


    def get_username_from_first_name(self):
        return frappe.scrub(self.first_name) + str(random.randint(0, 99))

    def remove_illegal_characters(self):
        return re.sub("[^\w]+", "", self.username).strip("_")

    def get_authored_courses(self) -> int:
        """Returns the number of courses authored by this user.
        """
        return frappe.get_all(
            'LMS Course', {
                'instructor': self.name,
                'is_published': True
        })

    def get_palette(self):
        """
        Returns a color unique to each member for Avatar """

        palette = [
            ['--orange-avatar-bg', '--orange-avatar-color'],
            ['--pink-avatar-bg', '--pink-avatar-color'],
            ['--blue-avatar-bg', '--blue-avatar-color'],
            ['--green-avatar-bg', '--green-avatar-color'],
            ['--dark-green-avatar-bg', '--dark-green-avatar-color'],
            ['--red-avatar-bg', '--red-avatar-color'],
            ['--yellow-avatar-bg', '--yellow-avatar-color'],
            ['--purple-avatar-bg', '--purple-avatar-color'],
            ['--gray-avatar-bg', '--gray-avatar-color0']
        ]

        encoded_name = str(self.full_name).encode("utf-8")
        hash_name = hashlib.md5(encoded_name).hexdigest()
        idx = cint((int(hash_name[4:6], 16) + 1) / 5.33)
        return palette[idx % 8]

    def get_batch_count(self) -> int:
        """Returns the number of batches authored by this user.
        """
        return frappe.db.count(
            'LMS Batch Membership', {
                'member': self.name,
                'member_type': 'Mentor'
            })

    def get_user_reviews(self):
        """ Returns the reviews created by user """
        return frappe.get_all("LMS Course Review",
                {
                    "owner": self.name
                })

    def get_course_membership(self, member_type=None):
        """ Returns all memberships of the user  """
        filters = {
            "member": self.name
        }
        if member_type:
            filters["member_type"] = member_type

        return frappe.get_all("LMS Batch Membership", filters, ["name", "course", "progress"])

    def get_mentored_courses(self):
        """ Returns all courses mentored by this user """
        mentored_courses = []
        mapping = frappe.get_all("LMS Course Mentor Mapping",
                    {
                        "mentor": self.name,
                    },
                    ["name", "course"]
                )

        for map in mapping:
            if frappe.db.get_value("LMS Course", map.course, "is_published"):
                course = frappe.get_doc("LMS Course", map.course)
                mentored_courses.append(course)

        return mentored_courses

    def get_enrolled_courses(self):
        in_progress = []
        completed = []
        memberships = self.get_course_membership("Student")
        for membership in memberships:
            course = frappe.get_doc("LMS Course", membership.course)
            progress = cint(membership.progress)
            if progress < 100:
                in_progress.append(course)
            else:
                completed.append(course)

        return {
            "in_progress": in_progress,
            "completed": completed
        }

@frappe.whitelist(allow_guest=True)
def sign_up(email, full_name, verify_age):
    if is_signup_disabled():
        frappe.throw(_('Sign Up is disabled'), title='Not Allowed')

    user = frappe.db.get("User", {"email": email})
    if user:
        if user.enabled:
            return 0, _("Already Registered")
        else:
            return 0, _("Registered but disabled")
    else:
        if frappe.db.get_creation_count('User', 60) > 300:
            frappe.respond_as_web_page(_('Temporarily Disabled'),
                _('Too many users signed up recently, so the registration is disabled. Please try back in an hour'),
                http_status_code=429)

    user = frappe.get_doc({
        "doctype":"User",
        "email": email,
        "first_name": escape_html(full_name),
        "verify_age": verify_age,
        "enabled": 1,
        "new_password": random_string(10),
        "user_type": "Website User"
    })
    user.flags.ignore_permissions = True
    user.flags.ignore_password_policy = True
    user.insert()

    set_country_from_ip(user.name)

    # set default signup role as per Portal Settings
    default_role = frappe.db.get_value("Portal Settings", None, "default_role")
    if default_role:
        user.add_roles(default_role)

    if user.flags.email_sent:
        return 1, _("Please check your email for verification")
    else:
        return 2, _("Please ask your administrator to verify your sign-up")


def set_country_from_ip(user=None):
    if not user:
        user = frappe.session.user

    user_country = frappe.db.get_value("User", user, "country")
    if user_country:
        return

    frappe.db.set_value("User", user, "country", get_country_code())
    return

def get_country_code():
    res = requests.get("http://ip-api.com/json/?fields=61439")

    try:
        data = res.json()
        if data.get("status") != "fail":
            return data.get("country")
    except Exception:
        pass

    return {}
