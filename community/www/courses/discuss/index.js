frappe.ready(() => {
	const assets = [
		"/assets/frappe/js/lib/socket.io.min.js",
		"/assets/frappe/js/frappe/socketio_client.js",
	]
	frappe.require(assets, () => {
		if (window.dev_server) {
			frappe.boot.socketio_port = "9000" //use socketio port shown when bench starts
		}
		frappe.socketio.init(9000);
	})

	setTimeout(() => {
		window.scrollTo(0, document.body.scrollHeight);
	}, 300);

	$(".msger-send-btn").click((e) => {
		e.preventDefault();
		var message = $(".msger-input").val().trim();
		if (message) {
			frappe.call({
				"method": "community.lms.doctype.lms_batch.lms_batch.save_message",
				"args": {
					"batch": decodeURIComponent($(e.target).attr("data-batch")),
					"message": message
				}
			})
		}
		else {
			$(".msger-input").val("");
		}
	})
})