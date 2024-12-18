import frappe
@frappe.whitelist()
def get_lms_courses():
    return frappe.get_list(
        'LMS Course',
        fields=['title', 'image','duration__month',"term_start_date"],
        # filters={'status': "Approved"},
        order_by='creation desc'
    )
