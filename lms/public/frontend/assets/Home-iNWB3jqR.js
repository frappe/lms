import {
	v as d,
	D as g,
	y as m,
	G as s,
	B as t,
	C as r,
	I as p,
	X as u,
	x as f,
	U as l,
} from "./frappe-ui-20hnMCM8.js";
const D = {
		name: "Home",
		data() {
			return { showDialog: !1 };
		},
		resources: { ping: { url: "ping" } },
		components: { Dialog: g },
	},
	_ = { class: "max-w-3xl py-12 mx-auto" };
function C(e, o, k, w, n, B) {
	const a = u("Button"),
		c = u("Dialog");
	return (
		f(),
		m("div", _, [
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
			r("div", null, p(e.$resources.ping.data), 1),
			r("pre", null, p(e.$resources.ping), 1),
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
const $ = d(D, [["render", C]]);
export { $ as default };
//# sourceMappingURL=Home-iNWB3jqR.js.map
