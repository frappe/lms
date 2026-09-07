# Copyright (c) 2021, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

from urllib.parse import quote, urlencode

import frappe

base_url = "https://api.unsplash.com"


def get_by_keyword(keyword):
	data = make_unsplash_request(f"/search/photos?query={quote(keyword)}")
	return (data or {}).get("results") or []


def get_list():
	return make_unsplash_request("/photos") or []


def get_random(params=None):
	return make_unsplash_request(f"/photos/random?{urlencode(params or {})}")


def make_unsplash_request(path):
	"""Return None when the integration is unconfigured. Callers that hand the
	result to the UI must coerce that to an empty result; an unconfigured site
	is the default, not an error."""
	unsplash_access_key = frappe.db.get_single_value("LMS Settings", "unsplash_access_key")
	if not unsplash_access_key:
		return

	import requests

	url = f"{base_url}{path}"
	res = requests.get(
		url,
		headers={
			"Accept-Version": "v1",
			"Authorization": f"Client-ID {unsplash_access_key}",
		},
	)
	res.raise_for_status()
	data = res.json()
	return data
