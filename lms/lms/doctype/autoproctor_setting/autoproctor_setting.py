# Copyright (c) 2025, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import base64
import hmac   
from hashlib import sha256


class AutoProctorSetting(Document):
	pass


@frappe.whitelist()
def get_autoproctor_credentials():
	autoproctor_setting = frappe.get_cached_doc("AutoProctor Setting")
	test_attempt_id = frappe.generate_hash(length=10)
	client_secret = autoproctor_setting.get_password("client_secret")
	payload = hmac.new(client_secret.encode('utf-8') , test_attempt_id.encode('utf-8'), sha256)
	base64_hashed_string = base64.b64encode(payload.digest()).decode()
	return {
        "clientId": autoproctor_setting.client_id,
        "testAttemptId": test_attempt_id,
        "hashedTestAttemptId": base64_hashed_string,
    }