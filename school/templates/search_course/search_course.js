frappe.ready(() => {
  $(".search-course").keyup((e) => {
    search_course(e);
  });
});

const search_course = (e) => {
  let input = $(e.currentTarget).val();
  console.log(input)
  if (input.length < 3 || input.trim() == "") {
    $(".course-card").removeClass("hide");
    return
  }

  frappe.call({
    method: "school.lms.doctype.lms_course.lms_course.search_course",
    args: {
      "text": input
    },
    callback: (data) => {
      render_course_list(data.message);
    }
  });
};

const render_course_list = (courses) => {
  $(".course-card").addClass("hide");
  for (course in courses) {
    console.log(courses[course])
    
  }
}

