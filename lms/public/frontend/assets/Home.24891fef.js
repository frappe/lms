import {
	b as d,
	D as g,
	r,
	o as m,
	d as f,
	e as t,
	w as s,
	j as l,
	k as p,
	t as u,
} from "./frappe-ui.8966d601.js";
const D = {
		name: "Home",
		data() {
			return { showDialog: !1 };
		},
		resources: { ping: { url: "ping" } },
		components: { Dialog: g },
	},
	_ = { class: "max-w-3xl py-12 mx-auto" };
function k(e, o, w, C, n, V) {
	const a = r("Button"),
		c = r("Dialog");
	return (
		m(),
		f("div", _, [
			t(
				a,
				{
					"icon-left": "code",
					onClick: e.$resources.ping.fetch,
					loading: e.$resources.ping.loading,
				},
				{
					default: s(() => [l(" Click to send 'ping' request ")]),
					_: 1,
				},
				8,
				["onClick", "loading"]
			),
			p("div", null, u(e.$resources.ping.data), 1),
			p("pre", null, u(e.$resources.ping), 1),
			t(
				a,
				{ onClick: o[0] || (o[0] = (i) => (n.showDialog = !0)) },
				{ default: s(() => [l("Open Dialog")]), _: 1 }
			),
			t(
				c,
				{
					title: "Title",
					modelValue: n.showDialog,
					"onUpdate:modelValue":
						o[1] || (o[1] = (i) => (n.showDialog = i)),
				},
				{ default: s(() => [l(" Dialog content ")]), _: 1 },
				8,
				["modelValue"]
			),
		])
	);
}
const B = d(D, [["render", k]]);
export { B as default };
