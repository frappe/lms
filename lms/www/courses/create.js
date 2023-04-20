frappe.ready(() => {
	$(".tags").click((e) => {
		e.preventDefault();
		$("#tags-input").focus();
	});

	$("#tags-input").focusout((e) => {
		create_tag(e);
	});

	$(document).on("click", ".btn-remove", (e) => {
		$(e.target).parent().parent().remove();
	});

	$("#image").change((e) => {
		$(e.target)
			.parent()
			.siblings("img")
			.addClass("image-preview")
			.attr("src", URL.createObjectURL(e.target.files[0]));
	});
});

const create_tag = (e) => {
	if ($(e.target).val() == "") {
		return;
	}
	let tag = `<button class="btn btn-secondary btn-sm mr-2 text-uppercase">
		${$(e.target).val()}
		<span class="btn-remove">
			<svg class="icon  icon-sm" style="">
				<use class="" href="#icon-close"></use>
			</svg>
		</span>
	</button>`;
	$(tag).insertBefore("#tags-input");
	$(e.target).val("");
};
