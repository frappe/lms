import frappe

def after_uninstall():
    delete_custom_fields()

def delete_custom_fields():
    fields = [ "user_category", "headline", "college", "city", "verify_terms", "country", "preferred_location",
        "preferred_functions", "preferred_industries", "work_environment_column", "time", "role", "carrer_preference_details",
        "skill", "certification_details", "internship", "branch", "github", "medium", "linkedin", "profession", "looking_for_job",
        "work_environment", "dream_companies", "career_preference_column", "attire", "collaboration", "location_preference",
        "company_type", "skill_details", "certification", "education", "work_experience", "education_details", "hide_private",
        "work_experience_details", "profile_complete", "cover_image"
    ]

    for field in fields:
        frappe.db.delete("Custom Field", {"fieldname": field})
        frappe.db.commit()
