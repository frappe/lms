from lms.lms.sidebar import seed_sidebar_items


def execute():
	"""Give sites installed before this shipped the thirteen built-in sidebar rows.

	Bounded by the catalogue: thirteen appends and one save on a Single, plus a
	stamp on each web-page row the site already had. LMS Settings is a Single,
	so that is one parent and a few dozen rows — a date cutoff and a row cap
	would bound nothing the work does not already bound.

	Idempotent: a name1 already present is skipped, so `migrate` twice changes
	nothing. Each built-in seeds `hidden` from the Check field it replaces, so a
	site with Jobs switched off keeps Jobs switched off.

	Not in this patch: clearing the seven Check fields. They stay set so a
	rollback still finds them, and `get_sidebar_settings` no longer reads them
	as the source of truth, so there is no live second source.
	"""
	seed_sidebar_items()
