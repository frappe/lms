frappe.ready(() => {
  $(".search-course").keyup((e) => {
    search_course(e);
  });
});

const search_course = (e) => {
  let input = $(e.currentTarget).val();

  if (input.length < 3 || input.trim() == "") {
    $(".course-card").removeClass("hide");
    $(".course-home-headings").parent().removeClass("hide");
    $(".upcoming-courses").addClass("mt-10");
    return;
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
    $("[data-course=" + courses[course].name + "]").removeClass("hide");
  }

  const visible_live_courses = $(".live-courses .course-card").not(".hide");
  const visible_upcoming_courses = $(".upcoming-courses .course-card").not(".hide");

  if (!visible_live_courses.length) {
    $(".live-courses").addClass("hide");
    $(".upcoming-courses").removeClass("mt-10");
  }

  if (!visible_upcoming_courses.length) {
    $(".upcoming-courses").addClass("hide");
  }
}

