"""
The plugins module provides various plugins to change the default
behaviour some parts of the community app.

A site specify what plugins to use using appropriate entries in the frappe
hooks, written in the `hooks.py`.

This module exposes two plugins: ProfileTab and PageExtension.

The ProfileTab is used to specify any additional tabs to be displayed
on the profile page of the user.

The PageExtension is used to load additinal stylesheets and scripts to
be loaded in a webpage.
"""

import frappe

class PageExtension:
    """PageExtension is a plugin to inject custom styles and scripts
    into a web page.

    The subclasses should overwrite the `render_header()` and
    `render_footer()` methods to inject whatever styles/scripts into
    the webpage.
    """

    def render_header(self):
        """Returns the HTML snippet to be included in the head section
        of the web page.

        Typically used to include the stylesheets and javascripts to be
        included in the <head> of the webpage.
        """
        return ""

    def render_footer(self):
        """Returns the HTML snippet to be included in the body tag at
        the end of web page.

        Typically used to include javascripts that need to be executed
        after the page is loaded.
        """
        return ""

class ProfileTab:
    """Base class for profile tabs.

    Every subclass of ProfileTab must implement two methods:
        - get_title()
        - render()
    """
    def __init__(self, user):
        self.user = user

    def get_title(self):
        """Returns the title of the tab.

        Every subclass must implement this.
        """
        raise NotImplementedError()

    def render(self):
        """Renders the contents of the tab as HTML.

        Every subclass must implement this.
        """
        raise NotImplementedError()

def quiz_renderer(quiz_name):
    quiz = frappe.get_doc("LMS Quiz", quiz_name)
    context = dict(quiz=quiz)
    return frappe.render_template("templates/quiz.html", context)

def exercise_renderer(argument):
    exercise = frappe.get_doc("Exercise", argument)
    context = dict(exercise=exercise)
    return frappe.render_template("templates/exercise.html", context)

def youtube_video_renderer(video_id):
    return f"""
    <iframe width="560" height="315"
        src="https://www.youtube.com/embed/{video_id}"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
    </iframe>
    """
