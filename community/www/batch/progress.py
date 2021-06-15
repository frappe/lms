import frappe
from community.lms.models import Course
from collections import defaultdict
from . import utils

def get_context(context):
    utils.get_common_context(context)

    exercise_name = frappe.form_dict.get("exercise")
    if exercise_name:
        exercise = frappe.get_doc("Exercise", exercise_name)
    else:
        exercise = None

    context.exercise = exercise
    context.report = BatchReport(context.course, context.batch)

class BatchReport:
    def __init__(self, course, batch):
        self.submissions = get_submissions(batch)
        self.exercises = self.get_exercises(course.name)
        self.submissions_by_exercise = defaultdict(list)
        for s in self.submissions:
            self.submissions_by_exercise[s.exercise].append(s)

    def get_exercises(self, course_name):
        return frappe.get_all("Exercise", {"course": course_name, "lesson": ["!=", ""]}, ["name", "title", "index_label"], order_by="index_label")

    def get_submissions_of_exercise(self, exercise_name):
        return self.submissions_by_exercise[exercise_name]

def get_submissions(batch):
    students = batch.get_students()
    students_map = {s.email: s for s in students}
    names, values = nparams("s", students_map.keys())
    sql = """
    select owner, exercise, name, solution, creation, image
    from (
        select owner, exercise, name, solution, creation, image,
            row_number() over (partition by owner, exercise order by creation desc) as ix
        from `tabExercise Submission`) as t
    where t.ix=1 and owner IN {}
    """.format(names)

    data = frappe.db.sql(sql, values=values, as_dict=True)
    for row in data:
        row['owner'] = students_map[row['owner']]
    return data

def nparams(name, values):
    """Creates n paramters from a list of values for a db query.

    >>> nparams("name", ["a", "b])
    ("(%(name_1)s, %(name_2)s)", {"name_1": "a", "name_2": "b"})
    """
    keys = [f"{name}_{i}" for i, _ in enumerate(values, start=1)]
    param_names = [f"%({k})s" for k in keys]
    param_values = dict(zip(keys, values))
    joined_names = "(" + ", ".join(param_names) + ")"
    return joined_names, param_values
