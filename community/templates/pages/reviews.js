
frappe.ready(() => {
  $("#provide-feedback").click((e) => {
    e.preventDefault();
    let d = new frappe.ui.Dialog({
      title: 'Provide your Feedback',
      fields: [
        {
          label: 'Rating',
          fieldname: 'rating',
          fieldtype: 'Rating'
        },
        {
          label: 'Review',
          fieldname: 'review',
          fieldtype: 'Small Text'
        }
      ],
      primary_action_label: 'Submit',
      primary_action(values) {
        console.log(values);
        frappe.call({
          method: "community.lms.doctype.lms_course.lms_course",
          args: {
            course: "{{ course.name }}",
            rating: values.rating,
            review: values.review
          },
          callback: (data) => {
            d.hide();
          }
        })
      }
    });
    d.show();
  })
})
