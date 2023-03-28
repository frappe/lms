<div style="background-color: #f4f5f6; padding: 1rem;">
    <div style="background-color: #ffffff; width: 75%; margin: 0 auto; padding: 1rem;">
        <h3> {{ _("Assignment Submission") }} </h3>
        {% set title = frappe.db.get_value("Course Lesson", doc.lesson, "title") %}
        <br>
        <p> {{ _("{0} has submitted their assignment for the lesson {1}").format(frappe.bold(doc.member_name), frappe.bold(title)) }}
        </p>
        <p> {{ _(" Please evaluate and grade the assignment.") }} </p>
    </div>
</div>

