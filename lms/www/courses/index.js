frappe.ready(() => {
    generate_graph("New Signups");
    generate_graph("Course Enrollments");

    $(".nav-link").click((e) => {
        change_hash(e);
    });

    if (window.location.hash) {
        open_tab();
    }
});

const generate_graph = (chart_name) => {
    let date = frappe.datetime;

    frappe.call({
        method: "lms.lms.utils.get_chart_data",
        args: {
            chart_name: chart_name,
            timespan: "Select Date Range",
            timegrain: "Daily",
            from_date: date.add_days(date.get_today(), -30),
            to_date: date.add_days(date.get_today(), +1),
        },
        callback: (data) => {
            render_chart(data.message, chart_name);
        },
    });
};

const render_chart = (data, chart_name) => {
    let dom_element =
        chart_name == "Course Enrollments"
            ? "#course-enrollments"
            : "#new-signups";
    const chart = new frappe.Chart(dom_element, {
        title: chart_name,
        data: data,
        type: "line",
        height: 250,
        colors: ["#4563f1"],
        axisOptions: {
            xIsSeries: 1,
        },
        lineOptions: {
            regionFill: 1,
        },
    });
};

const change_hash = (e) => {
    window.location.hash = $(e.currentTarget).attr("href");
};

const open_tab = () => {
    $(`a[href="${window.location.hash}"]`).click();
};
