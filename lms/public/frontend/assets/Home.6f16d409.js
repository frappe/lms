import {
	q as d,
	O as g,
	P as r,
	s as m,
	u as f,
	C as s,
	z as t,
	X as l,
	A as u,
	E as p,
} from "./frappe-ui.f2211ca2.js";
const D = {
		name: "Home",
		data() {
			return { showDialog: !1 };
		},
		resources: { ping: { url: "ping" } },
		components: { Dialog: g },
	},
	_ = { class: "max-w-3xl py-12 mx-auto" };
function C(e, o, k, w, n, V) {
	const a = r("Button"),
		c = r("Dialog");
	return (
		m(),
		f("div", _, [
			s(
				a,
				{
					"icon-left": "code",
					onClick: e.$resources.ping.fetch,
					loading: e.$resources.ping.loading,
				},
				{
					default: t(() => [l(" Click to send 'ping' request ")]),
					_: 1,
				},
				8,
				["onClick", "loading"]
			),
			u("div", null, p(e.$resources.ping.data), 1),
			u("pre", null, p(e.$resources.ping), 1),
			s(
				a,
				{ onClick: o[0] || (o[0] = (i) => (n.showDialog = !0)) },
				{ default: t(() => [l("Open Dialog")]), _: 1 }
			),
			s(
				c,
				{
					title: "Title",
					modelValue: n.showDialog,
					"onUpdate:modelValue":
						o[1] || (o[1] = (i) => (n.showDialog = i)),
				},
				{ default: t(() => [l(" Dialog content ")]), _: 1 },
				8,
				["modelValue"]
			),
		])
	);
}
const B = d(D, [["render", C]]);
export { B as default };
