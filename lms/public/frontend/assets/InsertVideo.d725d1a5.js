import {
	b as _,
	h as C,
	D as k,
	H as v,
	r,
	o as u,
	d as c,
	A as h,
	B,
	C as w,
	e as t,
	w as l,
	k as x,
	j as n,
	t as y,
	v as U,
	n as p,
	F,
} from "./frappe-ui.8966d601.js";
const A = {
		name: "InsertImage",
		props: ["editor"],
		expose: ["openDialog"],
		data() {
			return { addVideoDialog: { url: "", file: null, show: !1 } };
		},
		components: { Button: C, Dialog: k, FileUploader: v },
		methods: {
			openDialog() {
				this.addVideoDialog.show = !0;
			},
			onVideoSelect(i) {
				let o = i.target.files[0];
				!o || (this.addVideoDialog.file = o);
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
	I = { class: "flex items-center space-x-2" },
	N = ["src"];
function S(i, o, b, L, e, a) {
	const s = r("Button"),
		V = r("FileUploader"),
		g = r("Dialog");
	return (
		u(),
		c(
			F,
			null,
			[
				h(i.$slots, "default", B(w({ onClick: a.openDialog }))),
				t(
					g,
					{
						options: { title: "Add Video" },
						modelValue: e.addVideoDialog.show,
						"onUpdate:modelValue":
							o[2] || (o[2] = (d) => (e.addVideoDialog.show = d)),
						onAfterLeave: a.reset,
					},
					{
						"body-content": l(() => [
							t(
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
											x("div", I, [
												t(
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
										N
								  ))
								: p("", !0),
						]),
						actions: l(() => [
							t(
								s,
								{
									variant: "solid",
									onClick:
										o[1] ||
										(o[1] = (d) =>
											a.addVideo(e.addVideoDialog.url)),
								},
								{
									default: l(() => [n(" Insert Video ")]),
									_: 1,
								}
							),
							t(
								s,
								{ onClick: a.reset },
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
const R = _(A, [["render", S]]);
export { R as default };
