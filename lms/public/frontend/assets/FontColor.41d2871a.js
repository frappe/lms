import {
	b as f,
	P as g,
	T as _,
	r as d,
	o,
	v as l,
	w as r,
	A as p,
	B as C,
	C as k,
	k as a,
	d as c,
	F as u,
	m,
	q as h,
	p as b,
} from "./frappe-ui.8966d601.js";
const v = {
		name: "FontColor",
		props: ["editor"],
		components: { Popover: g, Tooltip: _ },
		methods: {
			setBackgroundColor(t) {
				t.name != "Default"
					? this.editor
							.chain()
							.focus()
							.toggleHighlight({ color: t.hex })
							.run()
					: this.editor.chain().focus().unsetHighlight().run();
			},
			setForegroundColor(t) {
				t.name != "Default"
					? this.editor.chain().focus().setColor(t.hex).run()
					: this.editor.chain().focus().unsetColor().run();
			},
		},
		computed: {
			foregroundColors() {
				return [
					{ name: "Default", hex: "#1F272E" },
					{ name: "Yellow", hex: "#ca8a04" },
					{ name: "Orange", hex: "#ea580c" },
					{ name: "Red", hex: "#dc2626" },
					{ name: "Green", hex: "#16a34a" },
					{ name: "Blue", hex: "#1579D0" },
					{ name: "Purple", hex: "#9333ea" },
					{ name: "Pink", hex: "#db2777" },
				];
			},
			backgroundColors() {
				return [
					{ name: "Default", hex: null },
					{ name: "Yellow", hex: "#fef9c3" },
					{ name: "Orange", hex: "#ffedd5" },
					{ name: "Red", hex: "#fee2e2" },
					{ name: "Green", hex: "#dcfce7" },
					{ name: "Blue", hex: "#D3E9FC" },
					{ name: "Purple", hex: "#f3e8ff" },
					{ name: "Pink", hex: "#fce7f3" },
				];
			},
		},
	},
	y = { class: "p-2" },
	B = a("div", { class: "text-sm text-gray-700" }, "Text Color", -1),
	P = { class: "mt-1 grid grid-cols-8 gap-1" },
	F = ["aria-label", "onClick"],
	w = a(
		"div",
		{ class: "mt-2 text-sm text-gray-700" },
		"Background Color",
		-1
	),
	D = { class: "mt-1 grid grid-cols-8 gap-1" },
	T = ["aria-label", "onClick"];
function A(t, z, E, R, $, n) {
	const i = d("Tooltip"),
		x = d("Popover");
	return (
		o(),
		l(
			x,
			{ transition: "default" },
			{
				target: r(({ togglePopover: e, isOpen: s }) => [
					p(
						t.$slots,
						"default",
						C(k({ onClick: () => e(), isActive: s }))
					),
				]),
				"body-main": r(() => [
					a("div", y, [
						B,
						a("div", P, [
							(o(!0),
							c(
								u,
								null,
								m(
									n.foregroundColors,
									(e) => (
										o(),
										l(
											i,
											{
												class: "flex",
												key: e.name,
												text: e.name,
											},
											{
												default: r(() => [
													a(
														"button",
														{
															"aria-label":
																e.name,
															class: "flex h-5 w-5 items-center justify-center rounded border text-base",
															style: h({
																color: e.hex,
															}),
															onClick: (s) =>
																n.setForegroundColor(
																	e
																),
														},
														" A ",
														12,
														F
													),
												]),
												_: 2,
											},
											1032,
											["text"]
										)
									)
								),
								128
							)),
						]),
						w,
						a("div", D, [
							(o(!0),
							c(
								u,
								null,
								m(
									n.backgroundColors,
									(e) => (
										o(),
										l(
											i,
											{
												class: "flex",
												key: e.name,
												text: e.name,
											},
											{
												default: r(() => [
													a(
														"button",
														{
															"aria-label":
																e.name,
															class: b([
																"flex h-5 w-5 items-center justify-center rounded border text-base text-gray-900",
																e.hex
																	? "border-transparent"
																	: "border-gray-200",
															]),
															style: h({
																backgroundColor:
																	e.hex,
															}),
															onClick: (s) =>
																n.setBackgroundColor(
																	e
																),
														},
														" A ",
														14,
														T
													),
												]),
												_: 2,
											},
											1032,
											["text"]
										)
									)
								),
								128
							)),
						]),
					]),
				]),
				_: 3,
			}
		)
	);
}
const G = f(v, [["render", A]]);
export { G as default };
