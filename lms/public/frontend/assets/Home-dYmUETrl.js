import {
	v as d,
	D as g,
	y as m,
	J as s,
	G as t,
	H as r,
	L as p,
	W as u,
	x as f,
	a4 as l,
} from "./frappe-ui-n1bXVQkV.js";
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
const v = d(D, [["render", k]]);
export { v as default };
//# sourceMappingURL=Home-dYmUETrl.js.map
