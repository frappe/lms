from setuptools import find_packages, setup

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in lms/__init__.py
from lms import __version__ as version

setup(
	name="lms",
	version=version,
	description="Learning Management System",
	author="Jannat",
	author_email="jannat@frappe.io",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires,
)
