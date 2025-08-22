import requests
import frappe
from frappe.utils.password import get_decrypted_password


@frappe.whitelist(allow_guest=True)
def fetch_users_from_site_a():
    return "hello world"
    # url = "http://192.168.54.98:8000/api/method/campus_erp.api.test.get_all_user"
 
    # users = []
    # response = requests.get(url)
    # # print(f"Response from Site A: {response.status_code} - {response.text}")
    # if response.status_code == 200:
    #     users = response.json()["message"]
    #     # print(f"Fetched {len(users)} users from Site A")
    # # return users
    # for user in users:
    #     # Check if user exists in Site B
    #     if not frappe.db.exists("User", user["name"]):
    #         frappe.get_doc({
    #             "doctype": "User",
    #             "email": user["email"],
    #             "first_name": user["full_name"],
    #             # "mobile_no": user.get("mobile_no"),
    #             "send_welcome_email": 0
    #         }).insert(ignore_permissions=True)
    #         print(f"User {user['name']} processed from Site A")
    #     frappe.db.commit()
    # else:
    #     frappe.throw(f"Error fetching users: {response.text}")
