# -*- coding: utf-8 -*-
import os
import subprocess
import sys
try:
    FileNotFoundError
except NameError:
    FileNotFoundError = IOError


class Configuration(object):
    def __init__(self, wkhtmltopdf='', meta_tag_prefix='pdfkit-', environ=''):
        self.meta_tag_prefix = meta_tag_prefix

        self.wkhtmltopdf = wkhtmltopdf

        try:
            if not self.wkhtmltopdf:
                if sys.platform == 'win32':
                    #hide cmd window
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = subprocess.SW_HIDE

                    self.wkhtmltopdf = subprocess.Popen(
                        ['where.exe', 'wkhtmltopdf'], stdout=subprocess.PIPE, startupinfo=startupinfo).communicate()[0]
                else:
                    self.wkhtmltopdf = subprocess.Popen(
                        ['which', 'wkhtmltopdf'], stdout=subprocess.PIPE).communicate()[0]

            lines = self.wkhtmltopdf.splitlines()
            if len(lines) > 0:
                self.wkhtmltopdf = lines[0].strip()

            with open(self.wkhtmltopdf) as f:
                pass
        except (IOError, FileNotFoundError) as e:
            raise IOError('No wkhtmltopdf executable found: "%s"\n'
                          'If this file exists please check that this process can '
                          'read it or you can pass path to it manually in method call, '
                          'check README. Otherwise please install wkhtmltopdf - '
                          'https://github.com/JazzCore/python-pdfkit/wiki/Installing-wkhtmltopdf' % self.wkhtmltopdf)


        self.environ = environ

        if not self.environ:
            self.environ = os.environ

        for key in self.environ.keys():
            if not isinstance(self.environ[key], str):
                self.environ[key] = str(self.environ[key])
