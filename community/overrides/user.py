import frappe
from frappe.core.doctype.user.user import User
from frappe.utils import cint
import hashlib

class CustomUser(User):

    def get_course_count(self) -> int:
        """Returns the number of courses authored by this user.
        """
        return frappe.db.count(
            'LMS Course', {
                'owner': self.email
        })

    def get_palette(self):
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

