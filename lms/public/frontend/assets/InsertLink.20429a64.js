import {
	b as d,
	h as g,
	I as L,
	D as m,
	r as i,
	o as p,
	d as f,
	A as D,
	B as h,
	C as c,
	e as l,
	w as a,
	E as w,
	j as _,
	F as v,
} from "./frappe-ui.8966d601.js";
const x = {
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
function V(t, e, C, B, n, s) {
	const r = i("FormControl"),
		u = i("Button"),
		k = i("Dialog");
	return (
		p(),
		f(
			v,
			null,
			[
				D(t.$slots, "default", h(c({ onClick: s.openDialog }))),
				l(
					k,
					{
						options: { title: "Set Link" },
						modelValue: n.setLinkDialog.show,
						"onUpdate:modelValue":
							e[3] || (e[3] = (o) => (n.setLinkDialog.show = o)),
						onAfterLeave: s.reset,
					},
					{
						"body-content": a(() => [
							l(
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
										(e[1] = w(
											(o) => s.setLink(o.target.value),
											["enter"]
										)),
								},
								null,
								8,
								["modelValue"]
							),
						]),
						actions: a(() => [
							l(
								u,
								{
									variant: "solid",
									onClick:
										e[2] ||
										(e[2] = (o) =>
											s.setLink(n.setLinkDialog.url)),
								},
								{ default: a(() => [_(" Save ")]), _: 1 }
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
const b = d(x, [["render", V]]);
export { b as default };
