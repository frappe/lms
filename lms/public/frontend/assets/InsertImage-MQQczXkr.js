import {
	v as I,
	a7 as f,
	D,
	aK as h,
	X as d,
	x as m,
	y as c,
	M as _,
	az as y,
	aA as C,
	G as n,
	B as s,
	C as i,
	I as v,
	J as w,
	U as u,
	Q as x,
} from "./frappe-ui-20hnMCM8.js";
const B = {
		name: "InsertImage",
		props: ["editor"],
		expose: ["openDialog"],
		data() {
			return { addImageDialog: { url: "", file: null, show: !1 } };
		},
		components: { Button: f, Dialog: D },
		methods: {
			openDialog() {
				this.addImageDialog.show = !0;
			},
			onImageSelect(t) {
				let e = t.target.files[0];
				e &&
					((this.addImageDialog.file = e),
					h(e).then((r) => {
						this.addImageDialog.url = r;
					}));
			},
			addImage(t) {
				this.editor.chain().focus().setImage({ src: t }).run(),
					this.reset();
			},
			reset() {
				this.addImageDialog = this.$options.data().addImageDialog;
			},
		},
	},
	b = {
		class: "relative cursor-pointer rounded-lg bg-gray-100 py-1 focus-within:bg-gray-200 hover:bg-gray-200",
	},
	k = { class: "absolute inset-0 select-none px-2 py-1 text-base" },
	S = ["src"];
function V(t, e, r, A, a, o) {
	const g = d("Button"),
		p = d("Dialog");
	return (
		m(),
		c(
			x,
			null,
			[
				_(t.$slots, "default", y(C({ onClick: o.openDialog }))),
				n(
					p,
					{
						options: { title: "Add Image" },
						modelValue: a.addImageDialog.show,
						"onUpdate:modelValue":
							e[2] || (e[2] = (l) => (a.addImageDialog.show = l)),
						onAfterLeave: o.reset,
					},
					{
						"body-content": s(() => [
							i("label", b, [
								i(
									"input",
									{
										type: "file",
										class: "w-full opacity-0",
										onChange:
											e[0] ||
											(e[0] = (...l) =>
												o.onImageSelect &&
												o.onImageSelect(...l)),
										accept: "image/*",
									},
									null,
									32
								),
								i(
									"span",
									k,
									v(
										a.addImageDialog.file
											? "Select another image"
											: "Select an image"
									),
									1
								),
							]),
							a.addImageDialog.url
								? (m(),
								  c(
										"img",
										{
											key: 0,
											src: a.addImageDialog.url,
											class: "mt-2 w-full rounded-lg",
										},
										null,
										8,
										S
								  ))
								: w("", !0),
						]),
						actions: s(() => [
							n(
								g,
								{
									variant: "solid",
									onClick:
										e[1] ||
										(e[1] = (l) =>
											o.addImage(a.addImageDialog.url)),
								},
								{
									default: s(() => [u(" Insert Image ")]),
									_: 1,
								}
							),
							n(
								g,
								{ onClick: o.reset },
								{ default: s(() => [u(" Cancel ")]), _: 1 },
								8,
								["onClick"]
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
const z = I(B, [["render", V]]);
export { z as default };
//# sourceMappingURL=InsertImage-MQQczXkr.js.map
