# Members and roles

## Members

These calls need the Moderator role, except `search_users_by_role`, which a Course Creator or Batch Evaluator can also call.

| Task | Call |
|---|---|
| Find members | `method call lms.lms.api.get_members -F search=<text> -F role=<role or All>`. It returns 13 at a time. Pass `start` for the next page, or `limit_page_length` for a bigger page. |
| Find people to make instructors | `method call lms.lms.api.search_users_by_role -F txt=<text> -F 'roles:=["Course Creator", "Moderator"]'` |
| Add a member | `method call lms.lms.api.add_member -F email=<e> -F first_name=<n> -F last_name=<n>` |
| Change a profile | `method call lms.lms.api.update_member -F member=<user> -F 'profile:={"bio": "..."}'` |
| Remove a member | `method call lms.lms.api.delete_member -F user=<user>` |

A new member gets the LMS Student role and nothing else. Give other roles with `save_role`. Ask the human before you remove a member, because it deletes their user.

## Roles

Learning has four roles. A Moderator or Batch Evaluator can read a user's roles with `method call lms.lms.utils.get_roles -F name=<user>`. Change one with `method call lms.lms.api.save_role -F user=<user> -F role=<role> -F value:=1` (or `value:=0` to remove it).

| Role | What it allows |
|---|---|
| Moderator | Everything in Learning: all courses, batches, members and roles. |
| Course Creator | Make courses and programs. Edit only the courses where they are an instructor. Edit a batch only where they are tagged. Cannot make a batch. |
| Batch Evaluator | Make and edit batches, add students, record evaluations and issue certificates. Making someone a Batch Evaluator also makes their evaluator record. Removing the role deletes the record and its slots. |
| LMS Student | Every new user has it. Read published content and enroll themselves. |

An instructor on a course can edit that course whatever their role is.
