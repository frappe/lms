import {
	c as u,
	a as l,
	_ as i,
	b as f,
	r as p,
	o as d,
	d as m,
	e as _,
	f as h,
	g as y,
	h as g,
	s as v,
	i as L,
} from "./frappe-ui.8966d601.js";
(function () {
	const o = document.createElement("link").relList;
	if (o && o.supports && o.supports("modulepreload")) return;
	for (const e of document.querySelectorAll('link[rel="modulepreload"]'))
		c(e);
	new MutationObserver((e) => {
		for (const t of e)
			if (t.type === "childList")
				for (const s of t.addedNodes)
					s.tagName === "LINK" && s.rel === "modulepreload" && c(s);
	}).observe(document, { childList: !0, subtree: !0 });
	function n(e) {
		const t = {};
		return (
			e.integrity && (t.integrity = e.integrity),
			e.referrerpolicy && (t.referrerPolicy = e.referrerpolicy),
			e.crossorigin === "use-credentials"
				? (t.credentials = "include")
				: e.crossorigin === "anonymous"
				? (t.credentials = "omit")
				: (t.credentials = "same-origin"),
			t
		);
	}
	function c(e) {
		if (e.ep) return;
		e.ep = !0;
		const t = n(e);
		fetch(e.href, t);
	}
})();
const E = [
	{
		path: "/",
		name: "Home",
		component: () =>
			i(
				() => import("./Home.24891fef.js"),
				[
					"assets/Home.24891fef.js",
					"assets/frappe-ui.8966d601.js",
					"assets/frappe-ui.e894a05e.css",
				]
			),
	},
	{
		path: "/courses",
		name: "Courses",
		component: () =>
			i(
				() => import("./Courses.10129947.js"),
				[
					"assets/Courses.10129947.js",
					"assets/frappe-ui.8966d601.js",
					"assets/frappe-ui.e894a05e.css",
					"assets/Courses.4fd15046.css",
				]
			),
	},
];
let O = u({ history: l("/"), routes: E });
const P = {};
function b(a, o) {
	const n = p("router-view");
	return d(), m("div", null, [_(n)]);
}
const A = f(P, [["render", b]]);
let r = h(A);
v("resourceFetcher", L);
r.use(O);
r.use(y);
r.component("Button", g);
r.mount("#app");
