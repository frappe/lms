# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import frappe
from frappe.utils import getdate

# Fields whose file is fetched by Guest or by an unauthenticated crawler, so it
# cannot be a private file. frappe-ui's FileUploader defaults uploads to
# is_private=1, and every LMS uploader used to stay silent, so these fields point
# at /private/files/ on any site that uploaded before that was fixed.
PUBLIC_FILE_FIELDS = (
	("Website Settings", "app_logo"),
	("Website Settings", "banner_image"),
	("Website Settings", "favicon"),
	("LMS Settings", "meta_image"),
	("LMS Course", "image"),
	("LMS Course", "video_link"),
	("LMS Batch", "meta_image"),
	("LMS Batch", "video_link"),
	("LMS Badge", "image"),
	("Job Opportunity", "company_logo"),
	("User", "user_image"),
	("User", "cover_image"),
)

PRIVATE_PREFIX = "/private/files/"
PUBLIC_PREFIX = "/files/"
BATCH_SIZE = 100

# Only files the regression could have created. frappe-ui started forcing
# is_private=1 in 1.0.0-beta.24; before that its fileUploadHandler sent
# is_private=0 on every upload that did not ask for privacy, so these fields held
# public files. LMS took the beta.24 bump in 71a397a4b on 2026-07-13 — anything
# private from before that was made private by hand, and stays that way.
REGRESSION_START = "2026-07-13"


def execute():
	summary = {"published": 0, "left_alone": 0, "failed": 0}

	for doctype, fieldname in PUBLIC_FILE_FIELDS:
		try:
			if not frappe.db.exists("DocType", doctype):
				continue

			meta = frappe.get_meta(doctype)
			if not meta.get_field(fieldname):
				continue

			if meta.issingle:
				migrate_single(doctype, fieldname, summary)
			else:
				migrate_rows(doctype, fieldname, summary)
		except Exception:
			# A doctype the site has customised into an unreadable state must cost
			# its own field, not the other eleven and not the rest of bench migrate.
			summary["failed"] += 1
			log(f"Could not read {doctype}.{fieldname}")

	frappe.logger("lms").info(f"make_public_images_public: {summary}")
	return summary


def migrate_single(doctype, fieldname, summary):
	public_url = publish(frappe.db.get_single_value(doctype, fieldname), summary)
	if public_url:
		frappe.db.set_single_value(doctype, fieldname, public_url)
		frappe.db.commit()


def migrate_rows(doctype, fieldname, summary):
	rows = frappe.get_all(
		doctype,
		filters={fieldname: ["like", f"{PRIVATE_PREFIX}%"]},
		fields=["name", fieldname],
	)

	for index, row in enumerate(rows, start=1):
		try:
			public_url = publish(row.get(fieldname), summary)
			if public_url:
				frappe.db.set_value(doctype, row.name, fieldname, public_url, update_modified=False)
		except Exception:
			summary["failed"] += 1
			log(f"Could not migrate {doctype} {row.name}.{fieldname}")

		if index % BATCH_SIZE == 0:
			frappe.db.commit()

	if rows:
		frappe.db.commit()


def publish(url, summary):
	"""Move the file behind `url` to public/files and return its new URL.

	Returning None means "leave the field alone". Every giving-up path leaves it
	on the private URL it already holds — the state the site is in today, never a
	worse one.
	"""
	if not url or not url.startswith(PRIVATE_PREFIX):
		return None

	public_url = PUBLIC_PREFIX + url[len(PRIVATE_PREFIX) :]

	files = frappe.get_all("File", filters={"file_url": url}, fields=["name", "content_hash", "creation"])
	if not files:
		# Two fields can hold the same URL (Website Settings app_logo and
		# banner_image always do). The first one moved the file, leaving this one
		# pointing at a path that no longer exists — repoint it, nothing to move.
		if frappe.db.exists("File", {"file_url": public_url}):
			return public_url

		# No File row on either side: nothing to move, nothing to point at. The
		# field keeps its dead URL and an admin gets told which one it is.
		summary["failed"] += 1
		log(f"No File record for {url}")
		return None

	file = files[0]
	if getdate(file.creation) < getdate(REGRESSION_START):
		summary["left_alone"] += 1
		return None

	if has_private_sibling(file.name, file.content_hash):
		summary["left_alone"] += 1
		return None

	try:
		file_doc = frappe.get_doc("File", file.name)
		file_doc.is_private = 0
		file_doc.save(ignore_permissions=True)
	except Exception:
		# handle_is_private_changed throws when the file is missing from
		# private/files or a same-named file already sits in public/files. Neither
		# may abort the migration.
		log(f"Could not make {url} public")
		return adopt_public_twin(file, public_url, summary)

	summary["published"] += 1
	return file_doc.file_url


def adopt_public_twin(file, public_url, summary):
	"""Fall back to a public file already holding these exact bytes.

	Both ways the move fails can still leave the bytes correctly in public/files:
	an earlier interrupted run moved them, or update_existing_file_docs claimed
	the URL for a row sharing the content_hash before the save threw. Matching on
	content_hash is what makes adopting safe — a same-named file with different
	bytes belongs to someone else, and pointing a course image at it would be
	worse than the broken image we started with.
	"""
	twin = file.content_hash and frappe.db.exists(
		"File", {"file_url": public_url, "content_hash": file.content_hash, "is_private": 0}
	)
	if not twin:
		summary["failed"] += 1
		return None

	frappe.db.set_value("File", file.name, {"file_url": public_url, "is_private": 0}, update_modified=False)
	summary["published"] += 1
	return public_url


def log(message):
	frappe.log_error(title="make_public_images_public", message=f"{message}\n\n{frappe.get_traceback()}")


def has_private_sibling(file_name, content_hash):
	"""True if the same bytes back a file outside PUBLIC_FILE_FIELDS.

	File.save() rewrites every File row sharing a content_hash
	(frappe/core/doctype/file/utils.py update_existing_file_docs), so publishing
	one would publish a payment gateway attachment or a résumé with it.
	"""
	if not content_hash:
		return False

	siblings = frappe.get_all(
		"File",
		filters={"content_hash": content_hash, "name": ["!=", file_name]},
		fields=["attached_to_doctype", "attached_to_field"],
	)

	return any(
		(sibling.attached_to_doctype, sibling.attached_to_field) not in PUBLIC_FILE_FIELDS
		for sibling in siblings
		if sibling.attached_to_doctype
	)
