frappe.ready(() => {
	pin_header();
});

const pin_header = () => {
	const el = document.querySelector(".sticky");
	const observer = new IntersectionObserver(
		([e]) =>
			e.target.classList.toggle("is-pinned", e.intersectionRatio < 1),
		{ threshold: [1] }
	);
	observer.observe(el);
};
