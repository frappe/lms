frappe.ready(() => {
	$("#submit").click(function () {
		frappe.call({
			method: "community.lms.doctype.invite_request.invite_request.create_invite_request",
			args: {
				invite_email: $("#invite_email").val()
			},
			callback: (data) => {
				if (data.message == "OK") {
					$("#invite-request-form").hide();
					var message = `<div>
					<p class="lead">Thanks for your interest in Mon School. We have recorded your interest and we will get back to you shortly.</p>
					</div>`;
					$(".jumbotron").append(message);
				}
			}
		})
	})
})