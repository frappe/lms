# Copyright (c) 2021, Frappe Technologies Pvt. Ltd. and Contributors
# See license.txt

import frappe

base_url = "https://api.unsplash.com"


def get_by_keyword(keyword):
	data = make_unsplash_request(f"/search/photos?query={keyword}")
	return data.get("results")


def get_list():
	return make_unsplash_request("/photos")


def get_random(params=None):
	query_string = ""
	for key, value in params.items():
		query_string += f"{key}={value}&"
	return make_unsplash_request(f"/photos/random?{query_string}")


def make_unsplash_request(path):
	if not "unsplash_access_key" in frappe.conf:
		frappe.throw("Please set unsplash_access_key in site_config.json")

	import requests

	url = f"{base_url}{path}"
	print(url)
	res = requests.get(
		url,
		headers={
			"Accept-Version": "v1",
			"Authorization": f"Client-ID {frappe.conf.unsplash_access_key}",
		},
	)
	res.raise_for_status()
	data = res.json()
	return data
