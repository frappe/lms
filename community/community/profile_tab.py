"""
The profile_tab module provides a pluggable way to add tabs to user
profiles.

This is achieved by specifying the profile_tabs in the hooks.

    profile_tabs = [
        'myapp.myapp.profile_tabs.SketchesTab'
    ]

When a profile page is rendered, these classes specified in the
profile_hooks are instanciated with the user as argument and used to
render the tabs.
"""

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
