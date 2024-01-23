import {
	v as _,
	a7 as C,
	D as v,
	aO as k,
	W as r,
	x as u,
	y as c,
	N as h,
	aD as x,
	aC as B,
	F as a,
	B as l,
	H as y,
	U as n,
	A as U,
	I as p,
	J as w,
	Q as F,
} from "./frappe-ui-iPT8hMkb.js";
const I = {
		name: "InsertImage",
		props: ["editor"],
		expose: ["openDialog"],
		data() {
			return { addVideoDialog: { url: "", file: null, show: !1 } };
		},
		components: { Button: C, Dialog: v, FileUploader: k },
		methods: {
			openDialog() {
				this.addVideoDialog.show = !0;
			},
			onVideoSelect(i) {
				let o = i.target.files[0];
				o && (this.addVideoDialog.file = o);
			},
			addVideo(i) {
				this.editor
					.chain()
					.focus()
					.insertContent(`<video src="${i}"></video>`)
					.run(),
					this.reset();
			},
			reset() {
				this.addVideoDialog = this.$options.data().addVideoDialog;
			},
		},
	},
	N = { class: "flex items-center space-x-2" },
	A = ["src"];
function S(i, o, L, P, e, t) {
	const s = r("Button"),
		V = r("FileUploader"),
		g = r("Dialog");
	return (
		u(),
		c(
			F,
			null,
			[
				h(i.$slots, "default", x(B({ onClick: t.openDialog }))),
				a(
					g,
					{
						options: { title: "Add Video" },
						modelValue: e.addVideoDialog.show,
						"onUpdate:modelValue":
							o[2] || (o[2] = (d) => (e.addVideoDialog.show = d)),
						onAfterLeave: t.reset,
					},
					{
						"body-content": l(() => [
							a(
								V,
								{
									"file-types": "video/*",
									onSuccess:
										o[0] ||
										(o[0] = (d) =>
											(e.addVideoDialog.url =
												d.file_url)),
								},
								{
									default: l(
										({
											file: d,
											progress: f,
											uploading: m,
											openFileSelector: D,
										}) => [
											w("div", N, [
												a(
													s,
													{ onClick: D },
													{
														default: l(() => [
															n(
																y(
																	m
																		? `Uploading ${f}%`
																		: e
																				.addVideoDialog
																				.url
																		? "Change Video"
																		: "Upload Video"
																),
																1
															),
														]),
														_: 2,
													},
													1032,
													["onClick"]
												),
												e.addVideoDialog.url
													? (u(),
													  U(
															s,
															{
																key: 0,
																onClick: () => {
																	(e.addVideoDialog.url =
																		null),
																		(e.addVideoDialog.file =
																			null);
																},
															},
															{
																default: l(
																	() => [
																		n(
																			" Remove "
																		),
																	]
																),
																_: 2,
															},
															1032,
															["onClick"]
													  ))
													: p("", !0),
											]),
										]
									),
									_: 1,
								}
							),
							e.addVideoDialog.url
								? (u(),
								  c(
										"video",
										{
											key: 0,
											src: e.addVideoDialog.url,
											class: "mt-2 w-full rounded-lg",
											type: "video/mp4",
											controls: "",
										},
										null,
										8,
										A
								  ))
								: p("", !0),
						]),
						actions: l(() => [
							a(
								s,
								{
									variant: "solid",
									onClick:
										o[1] ||
										(o[1] = (d) =>
											t.addVideo(e.addVideoDialog.url)),
								},
								{
									default: l(() => [n(" Insert Video ")]),
									_: 1,
								}
							),
							a(
								s,
								{ onClick: t.reset },
								{ default: l(() => [n("Cancel")]), _: 1 },
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
const b = _(I, [["render", S]]);
export { b as default };
//# sourceMappingURL=InsertVideo-5zm7I1WB.js.map
