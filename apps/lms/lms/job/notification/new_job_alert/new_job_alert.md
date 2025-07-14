Hey,

A new Job Opportunity has been created. 

<p>Company Name: {{ doc.company_name}}</p>
<p>Job Title: {{ doc.job_title}}</p>
<p>Job Location: {{ doc.location}}</p><br>
<p>Job Description: {{ doc.description}}</p><br>

<p>Find all the posted jobs  <a href="{{ frappe.utils.get_url() }}/app/job-opportunity">here</a>.</p><br>
