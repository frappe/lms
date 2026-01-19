frappe.pages["lms-home"].on_page_load = function (wrapper) {
	const lmsPath = frappe.boot.lms_path || "lms";
	window.location.href = `/${lmsPath}/courses`;
};
