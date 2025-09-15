import frappe


def get_context(context):
    context.no_cache = 1
    certificate_id = frappe.form_dict.certificate_id

    if not certificate_id:
        context.error = "❌ Certificate ID tidak ditemukan di URL"
        return context

    try:
        frappe.get_doc("LMS Certificate", certificate_id)
    except frappe.DoesNotExistError:
        context.error = f"❌ Certificate {certificate_id} tidak ditemukan"
        return context

    context.certificate_id = certificate_id
    context.iframe_url = (
        f"/printview?doctype=LMS Certificate"
        f"&name={certificate_id}"
        f"&no_letterhead=0"
    )
    context.title = f"Certificate Verification - {certificate_id}"

    return context
