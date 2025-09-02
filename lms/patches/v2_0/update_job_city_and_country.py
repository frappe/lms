import frappe


def execute():
	jobs = frappe.get_all("Job Opportunity", fields=["name", "location"])

	for job in jobs:
		if "," in job.location:
			city, country = job.location.split(",", 1)
			city = city.strip()
			country = country.strip()
			save_country(country, job)
			frappe.db.set_value("Job Opportunity", job.name, "location", city)
		else:
			save_country(job.location, job)


def save_country(country, job):
	if frappe.db.exists("Country", country):
		frappe.db.set_value("Job Opportunity", job.name, "country", country)
	else:
		country_mapping = {
			"US": "United States",
			"USA": "United States",
			"UAE": "United Arab Emirates",
		}
		country = country_mapping.get(country, country)
		frappe.db.set_value("Job Opportunity", job.name, "country", country)
