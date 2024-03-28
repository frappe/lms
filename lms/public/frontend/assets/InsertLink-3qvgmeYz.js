import {
	v as d,
	a7 as g,
	ai as L,
	D as m,
	W as i,
	x as p,
	y as f,
	O as D,
	aG as c,
	aH as h,
	J as a,
	G as l,
	ay as v,
	a4 as x,
	Q as _,
} from "./frappe-ui-n1bXVQkV.js";
const w = {
	name: "InsertLink",
	props: ["editor"],
	components: { Button: g, Input: L, Dialog: m },
	data() {
		return { setLinkDialog: { url: "", show: !1 } };
	},
	methods: {
		openDialog() {
			let t = this.editor.getAttributes("link").href;
			t && (this.setLinkDialog.url = t), (this.setLinkDialog.show = !0);
		},
		setLink(t) {
			t === ""
				? this.editor
						.chain()
						.focus()
						.extendMarkRange("link")
						.unsetLink()
						.run()
				: this.editor
						.chain()
						.focus()
						.extendMarkRange("link")
						.setLink({ href: t })
						.run(),
				(this.setLinkDialog.show = !1),
				(this.setLinkDialog.url = "");
		},
		reset() {
			this.setLinkDialog = this.$options.data().setLinkDialog;
		},
	},
};
function V(t, e, y, C, n, s) {
	const r = i("FormControl"),
		u = i("Button"),
		k = i("Dialog");
	return (
		p(),
		f(
			_,
			null,
			[
				D(t.$slots, "default", c(h({ onClick: s.openDialog }))),
				a(
					k,
					{
						options: { title: "Set Link" },
						modelValue: n.setLinkDialog.show,
						"onUpdate:modelValue":
							e[3] || (e[3] = (o) => (n.setLinkDialog.show = o)),
						onAfterLeave: s.reset,
					},
					{
						"body-content": l(() => [
							a(
								r,
								{
									type: "text",
									label: "URL",
									modelValue: n.setLinkDialog.url,
									"onUpdate:modelValue":
										e[0] ||
										(e[0] = (o) =>
											(n.setLinkDialog.url = o)),
									onKeydown:
										e[1] ||
										(e[1] = v(
											(o) => s.setLink(o.target.value),
											["enter"]
										)),
								},
								null,
								8,
								["modelValue"]
							),
						]),
						actions: l(() => [
							a(
								u,
								{
									variant: "solid",
									onClick:
										e[2] ||
										(e[2] = (o) =>
											s.setLink(n.setLinkDialog.url)),
								},
								{ default: l(() => [x(" Save ")]), _: 1 }
							),
						]),
						_: 1,
					},
					8,
					["modelValue", "onAfterLeave"]
				),
			],
			64
		)
	);
}
const R = d(w, [["render", V]]);
export { R as default };
//# sourceMappingURL=InsertLink-3qvgmeYz.js.map
