# your_app/constants/custom_fields.py

CUSTOM_FIELDS = {
    "LMS Enrollment": [
        {
            "fieldname": "presence_status",
            "label": "Presence Status",
            "fieldtype": "Select",
            "options": "Present\nAbsent",
            "insert_after": "payment",
            "insert_before": "current_lesson",
            "default": "Present",
        }
    ]
}
