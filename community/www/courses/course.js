frappe.ready(() => {
	var dropdown = document.getElementById("batches-dropdown")
	if (dropdown) {
		dropdown.onchange = () => {
			frappe.call("community.www.courses.course.get_messages", {batch: dropdown.value}, (data) => {
				var href_params = new URLSearchParams($(".add-message").children("a")[0].href)
				$(".add-message").children("a")[0].href = `/add-messages?new=1&batch=${dropdown.value}&author=${href_params.get("author")}&course=${href_params.get("course")}`
				if(data.message){
					$(".discussions").children().remove()
					for (var i = 0; i < data.message.length; i++) {
						var message = data.message[i]
						var element = `<div class="list-group-item">
											<h6> ${message.author} </h6>
											${ message.message }
											<div class="small text-muted text-right"> ${ message.creation } </div>
										</div>`
						$(".discussions").append(element)
					}
				}
			})
		}
	}
	/* if(frappe.session.user != "Guest"){
		frappe.call('community.www.courses.course.has_enrolled', { course: get_search_params().get("course") }, (data) => {
			if (data.message) {
				show_enrollment_badge()
			}
		})
	} */
})
/* 
var show_enrollment_badge = () => {
	$(".btn-enroll").addClass("hide");
	$(".enrollment-badge").removeClass("hide");
}

var get_search_params = () => {
	return new URLSearchParams(window.location.search)
}

$('.btn-enroll').on('click', (e) => {
	frappe.call('community.www.courses.course.enroll', { course: get_search_params().get("course") }, (data) => {
		show_enrollment_badge()
	});
}); */

