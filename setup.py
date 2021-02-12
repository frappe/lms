# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in community/__init__.py
from community import __version__ as version

setup(
	name='community',
	version=version,
	description='Community App',
	author='Frappe',
	author_email='jannat@erpnext.com',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
