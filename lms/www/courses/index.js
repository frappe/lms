
frappe.ready(() => {
    if (frappe.session.user != "Guest") {
        generate_graph("New Signups");
        generate_graph("Course Enrollments");
    }
});


const generate_graph = (chart_name) => {
    let date = frappe.datetime;

    frappe.call({
        method: "frappe.desk.doctype.dashboard_chart.dashboard_chart.get",
        args: {
            "chart_name": chart_name,
            "timespan": "Select Date Range",
            "from_date": date.add_days(date.get_today(), -30),
            "to_date": date.get_today()
        },
        callback: (data) => {
            render_chart(data.message, chart_name);
        }
    });
};


const render_chart = (data, chart_name) => {
    let dom_element = chart_name == "Course Enrollments" ? "#course-enrollments" : "#new-signups";
    const chart = new frappe.Chart(dom_element, {
        title: chart_name,
        data: data,
        type: 'line',
        height: 250,
        colors: ['#4563f1'],
        axisOptions: {
            xIsSeries: 1,
        },
    });
};
