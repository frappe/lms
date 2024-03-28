import {
	r as B,
	aD as J,
	aE as X,
	j as x,
	w as A,
	n as Q,
	x as n,
	F,
	G as c,
	J as w,
	K as a,
	aF as Z,
	O as g,
	aG as C,
	aH as V,
	H as v,
	I,
	y as p,
	L as N,
	aI as R,
	aJ as W,
	aK as Y,
	Q as U,
	R as E,
	M as q,
	aL as ee,
	a4 as te,
	aM as G,
	aN as ae,
	aO as H,
	k as se,
	aP as le,
	a7 as re,
} from "./frappe-ui-n1bXVQkV.js";
import { a as oe, C as ue } from "./index-xt-hKVBz.js";
import { P as ne } from "./plus-w56hNznP.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const ie = oe("XIcon", [
		["path", { d: "M18 6 6 18", key: "1bl5f8" }],
		["path", { d: "m6 6 12 12", key: "d8bk6v" }],
	]),
	de = { class: "w-full" },
	ce = ["onClick"],
	pe = { class: "flex items-center" },
	fe = {
		key: 0,
		class: "overflow-hidden text-ellipsis whitespace-nowrap text-base leading-5",
	},
	me = { key: 1, class: "text-base leading-5 text-gray-500" },
	ye = { class: "mt-1 rounded-lg bg-white py-1 text-base shadow-2xl" },
	be = { class: "relative px-1.5 pt-0.5" },
	ve = { key: 0, class: "px-2.5 py-1.5 text-sm font-medium text-gray-500" },
	ge = {
		key: 0,
		class: "mt-1.5 rounded-md px-2.5 py-1.5 text-base text-gray-600",
	},
	he = { key: 0, class: "border-t p-1.5 pb-0.5" },
	xe = {
		__name: "Autocomplete",
		props: {
			modelValue: { type: String, default: "" },
			options: { type: Array, default: () => [] },
			size: { type: String, default: "md" },
			variant: { type: String, default: "subtle" },
			placeholder: { type: String, default: "" },
			disabled: { type: Boolean, default: !1 },
			filterable: { type: Boolean, default: !0 },
		},
		emits: ["update:modelValue", "update:query", "change"],
		setup(j, { expose: D, emit: f }) {
			const r = j,
				u = f,
				i = B(""),
				h = B(!1),
				S = B(null),
				k = J(),
				z = X(),
				L = x(() => "value" in k),
				_ = x({
					get() {
						return L.value ? k.value : r.modelValue;
					},
					set(t) {
						(i.value = ""),
							t && (h.value = !1),
							u(L.value ? "change" : "update:modelValue", t);
					},
				});
			function e() {
				h.value = !1;
			}
			const m = x(() => {
				var s;
				return !r.options || r.options.length == 0
					? []
					: ((s = r.options[0]) != null && s.group
							? r.options
							: [{ group: "", items: r.options }]
					  )
							.map((l, o) => ({
								key: o,
								group: l.group,
								hideLabel: l.hideLabel || !1,
								items: r.filterable ? d(l.items) : l.items,
							}))
							.filter((l) => l.items.length > 0);
			});
			function d(t) {
				return i.value
					? t.filter((s) =>
							[s.label, s.value].some((o) =>
								(o || "")
									.toString()
									.toLowerCase()
									.includes(i.value.toLowerCase())
							)
					  )
					: t;
			}
			function y(t) {
				if (typeof t == "string") {
					let l = m.value
						.flatMap((o) => o.items)
						.find((o) => o.value === t);
					return (l == null ? void 0 : l.label) || t;
				}
				return t == null ? void 0 : t.label;
			}
			A(i, (t) => {
				u("update:query", t);
			}),
				A(h, (t) => {
					t &&
						Q(() => {
							S.value.el.focus();
						});
				});
			const $ = x(() => (r.disabled ? "text-gray-600" : "text-gray-800")),
				K = x(() => {
					let t = {
							sm: "text-base rounded h-7",
							md: "text-base rounded h-8",
							lg: "text-lg rounded-md h-10",
							xl: "text-xl rounded-md h-10",
						}[r.size],
						s = {
							sm: "py-1.5 px-2",
							md: "py-1.5 px-2.5",
							lg: "py-1.5 px-3",
							xl: "py-1.5 px-3",
						}[r.size],
						l = r.disabled ? "disabled" : r.variant,
						o = {
							subtle: "border border-gray-100 bg-gray-100 placeholder-gray-500 hover:border-gray-200 hover:bg-gray-200 focus:bg-white focus:border-gray-500 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-gray-400",
							outline:
								"border border-gray-300 bg-white placeholder-gray-500 hover:border-gray-400 hover:shadow-sm focus:bg-white focus:border-gray-500 focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-gray-400",
							disabled: [
								"border bg-gray-50 placeholder-gray-400",
								r.variant === "outline"
									? "border-gray-300"
									: "border-transparent",
							],
						}[l];
					return [t, s, o, $.value, "transition-colors w-full"];
				});
			return (
				D({ query: i }),
				(t, s) => (
					n(),
					F(
						a(ae),
						{
							modelValue: _.value,
							"onUpdate:modelValue":
								s[3] || (s[3] = (l) => (_.value = l)),
							nullable: "",
						},
						{
							default: c(({ open: l }) => [
								w(
									a(Z),
									{
										class: "w-full",
										show: h.value,
										"onUpdate:show":
											s[2] ||
											(s[2] = (o) => (h.value = o)),
									},
									{
										target: c(
											({ open: o, togglePopover: P }) => [
												g(
													t.$slots,
													"target",
													C(
														V({
															open: o,
															togglePopover: P,
														})
													),
													() => [
														v("div", de, [
															v(
																"button",
																{
																	class: I([
																		"flex w-full items-center justify-between focus:outline-none",
																		K.value,
																	]),
																	onClick:
																		() =>
																			P(),
																},
																[
																	v(
																		"div",
																		pe,
																		[
																			g(
																				t.$slots,
																				"prefix"
																			),
																			_.value
																				? (n(),
																				  p(
																						"span",
																						fe,
																						N(
																							y(
																								_.value
																							)
																						),
																						1
																				  ))
																				: (n(),
																				  p(
																						"span",
																						me,
																						N(
																							j.placeholder ||
																								""
																						),
																						1
																				  )),
																		]
																	),
																	w(a(ue), {
																		class: "h-4 w-4 stroke-1.5",
																	}),
																],
																10,
																ce
															),
														]),
													]
												),
											]
										),
										body: c(({ isOpen: o }) => {
											var P;
											return [
												R(
													v(
														"div",
														null,
														[
															v("div", ye, [
																v("div", be, [
																	w(
																		a(W),
																		{
																			ref_key:
																				"search",
																			ref: S,
																			class: "form-input w-full",
																			type: "text",
																			onChange:
																				s[0] ||
																				(s[0] =
																					(
																						b
																					) => {
																						i.value =
																							b.target.value;
																					}),
																			value: i.value,
																			autocomplete:
																				"off",
																			placeholder:
																				"Search",
																		},
																		null,
																		8,
																		[
																			"value",
																		]
																	),
																	v(
																		"button",
																		{
																			class: "absolute right-1.5 inline-flex h-7 w-7 items-center justify-center",
																			onClick:
																				s[1] ||
																				(s[1] =
																					(
																						b
																					) =>
																						(_.value =
																							null)),
																		},
																		[
																			w(
																				a(
																					ie
																				),
																				{
																					class: "h-4 w-4 stroke-1.5",
																				}
																			),
																		]
																	),
																]),
																w(
																	a(Y),
																	{
																		class: "my-1 max-h-[12rem] overflow-y-auto px-1.5",
																		static: "",
																	},
																	{
																		default:
																			c(
																				() => [
																					(n(
																						!0
																					),
																					p(
																						U,
																						null,
																						E(
																							m.value,
																							(
																								b
																							) =>
																								R(
																									(n(),
																									p(
																										"div",
																										{
																											class: "mt-1.5",
																											key: b.key,
																										},
																										[
																											b.group &&
																											!b.hideLabel
																												? (n(),
																												  p(
																														"div",
																														ve,
																														N(
																															b.group
																														),
																														1
																												  ))
																												: q(
																														"",
																														!0
																												  ),
																											(n(
																												!0
																											),
																											p(
																												U,
																												null,
																												E(
																													b.items,
																													(
																														O
																													) => (
																														n(),
																														F(
																															a(
																																ee
																															),
																															{
																																as: "template",
																																key: O.value,
																																value: O,
																															},
																															{
																																default:
																																	c(
																																		({
																																			active: T,
																																			selected:
																																				M,
																																		}) => [
																																			v(
																																				"li",
																																				{
																																					class: I(
																																						[
																																							"flex items-center rounded px-2.5 py-1.5 text-base",
																																							{
																																								"bg-gray-100":
																																									T,
																																							},
																																						]
																																					),
																																				},
																																				[
																																					g(
																																						t.$slots,
																																						"item-prefix",
																																						C(
																																							V(
																																								{
																																									active: T,
																																									selected:
																																										M,
																																									option: O,
																																								}
																																							)
																																						)
																																					),
																																					g(
																																						t.$slots,
																																						"item-label",
																																						C(
																																							V(
																																								{
																																									active: T,
																																									selected:
																																										M,
																																									option: O,
																																								}
																																							)
																																						),
																																						() => [
																																							te(
																																								N(
																																									O.label
																																								),
																																								1
																																							),
																																						]
																																					),
																																				],
																																				2
																																			),
																																		]
																																	),
																																_: 2,
																															},
																															1032,
																															[
																																"value",
																															]
																														)
																													)
																												),
																												128
																											)),
																										]
																									)),
																									[
																										[
																											G,
																											b
																												.items
																												.length >
																												0,
																										],
																									]
																								)
																						),
																						128
																					)),
																					m
																						.value
																						.length ==
																					0
																						? (n(),
																						  p(
																								"li",
																								ge,
																								" No results found "
																						  ))
																						: q(
																								"",
																								!0
																						  ),
																				]
																			),
																		_: 3,
																	}
																),
																a(z).footer
																	? (n(),
																	  p(
																			"div",
																			he,
																			[
																				g(
																					t.$slots,
																					"footer",
																					C(
																						V(
																							{
																								value:
																									(P =
																										S.value) ==
																									null
																										? void 0
																										: P
																												.el
																												._value,
																								close: e,
																							}
																						)
																					)
																				),
																			]
																	  ))
																	: q("", !0),
															]),
														],
														512
													),
													[[G, o]]
												),
											];
										}),
										_: 3,
									},
									8,
									["show"]
								),
							]),
							_: 3,
						},
						8,
						["modelValue"]
					)
				)
			);
		},
	},
	we = { class: "space-y-1.5" },
	Ve = {
		__name: "Link",
		props: {
			doctype: { type: String, required: !0 },
			filters: { type: Object, default: () => ({}) },
			modelValue: { type: String, default: "" },
		},
		emits: ["update:modelValue", "change"],
		setup(j, { emit: D }) {
			const f = j,
				r = D,
				u = J(),
				i = x(() => "value" in u),
				h = x({
					get: () => (i.value ? u.value : f.modelValue),
					set: (e) => (
						console.log(e == null ? void 0 : e.value, i.value),
						(e == null ? void 0 : e.value) &&
							r(
								i.value ? "change" : "update:modelValue",
								e == null ? void 0 : e.value
							)
					),
				}),
				S = B(null),
				k = B("");
			H(
				() => {
					var e;
					return (e = S.value) == null ? void 0 : e.query;
				},
				(e) => {
					(e = e || ""), k.value !== e && ((k.value = e), L(e));
				},
				{ debounce: 300, immediate: !0 }
			),
				H(
					() => f.doctype,
					() => L(""),
					{ debounce: 300, immediate: !0 }
				);
			const z = se({
				url: "frappe.desk.search.search_link",
				cache: [f.doctype, k.value],
				method: "POST",
				params: {
					txt: k.value,
					doctype: f.doctype,
					filters: f.filters,
				},
				transform: (e) =>
					e.map((m) => ({ label: m.value, value: m.value })),
			});
			function L(e) {
				z.update({
					params: { txt: e, doctype: f.doctype, filters: f.filters },
				}),
					z.reload();
			}
			const _ = x(() => [
				{ sm: "text-xs", md: "text-base" }[u.size || "sm"],
				"text-gray-600",
			]);
			return (e, m) => (
				n(),
				p("div", we, [
					a(u).label
						? (n(),
						  p(
								"label",
								{ key: 0, class: I(["block", _.value]) },
								N(a(u).label),
								3
						  ))
						: q("", !0),
					w(
						xe,
						{
							ref_key: "autocomplete",
							ref: S,
							options: a(z).data,
							modelValue: h.value,
							"onUpdate:modelValue":
								m[0] || (m[0] = (d) => (h.value = d)),
							size: a(u).size || "sm",
							variant: a(u).variant,
							placeholder: a(u).placeholder,
							filterable: !1,
						},
						le(
							{
								target: c(({ open: d, togglePopover: y }) => [
									g(
										e.$slots,
										"target",
										C(V({ open: d, togglePopover: y }))
									),
								]),
								prefix: c(() => [g(e.$slots, "prefix")]),
								"item-prefix": c(
									({ active: d, selected: y, option: $ }) => [
										g(
											e.$slots,
											"item-prefix",
											C(
												V({
													active: d,
													selected: y,
													option: $,
												})
											)
										),
									]
								),
								"item-label": c(
									({ active: d, selected: y, option: $ }) => [
										g(
											e.$slots,
											"item-label",
											C(
												V({
													active: d,
													selected: y,
													option: $,
												})
											)
										),
									]
								),
								_: 2,
							},
							[
								a(u).onCreate
									? {
											name: "footer",
											fn: c(({ value: d, close: y }) => [
												v("div", null, [
													w(
														a(re),
														{
															variant: "ghost",
															class: "w-full !justify-start",
															label: "Create New",
															onClick: ($) =>
																a(u).onCreate(
																	d,
																	y
																),
														},
														{
															prefix: c(() => [
																w(a(ne), {
																	class: "h-4 w-4 stroke-1.5",
																}),
															]),
															_: 2,
														},
														1032,
														["onClick"]
													),
												]),
											]),
											key: "0",
									  }
									: void 0,
							]
						),
						1032,
						[
							"options",
							"modelValue",
							"size",
							"variant",
							"placeholder",
						]
					),
				])
			);
		},
	};
export { ie as X, Ve as _ };
//# sourceMappingURL=Link-xVzNCgtj.js.map
