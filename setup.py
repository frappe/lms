# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in school/__init__.py
from school import __version__ as version

setup(
	name='school',
	version=version,
	description='school App',
	author='Frappe',
	author_email='school@frappe.io',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
