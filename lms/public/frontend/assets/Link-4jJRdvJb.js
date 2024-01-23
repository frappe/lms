import {
	r as O,
	az as M,
	aA as K,
	j as x,
	w as U,
	n as Q,
	x as n,
	A as F,
	B as d,
	aB as Z,
	G as a,
	aC as C,
	aD as V,
	C as T,
	N as g,
	H as N,
	y as p,
	J as b,
	F as w,
	aE as W,
	aF as Y,
	Q as R,
	I as q,
	aG as ee,
	U as te,
	R as E,
	aH as G,
	aI as H,
	aJ as ae,
	aK as J,
	k as se,
	aL as le,
	a7 as re,
} from "./frappe-ui-iPT8hMkb.js";
import { a as oe, C as ue } from "./index-qZ7Yta4u.js";
import { P as ne } from "./plus-_m-8cMp1.js";
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
	ve = { class: "relative px-1.5 pt-0.5" },
	be = { key: 0, class: "px-2.5 py-1.5 text-sm font-medium text-gray-500" },
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
		setup(j, { expose: A, emit: f }) {
			const r = j,
				u = f,
				c = O(""),
				h = O(!1),
				S = O(null),
				k = M(),
				z = K(),
				L = x(() => "value" in k),
				_ = x({
					get() {
						return L.value ? k.value : r.modelValue;
					},
					set(t) {
						(c.value = ""),
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
								items: r.filterable ? i(l.items) : l.items,
							}))
							.filter((l) => l.items.length > 0);
			});
			function i(t) {
				return c.value
					? t.filter((s) =>
							[s.label, s.value].some((o) =>
								(o || "")
									.toString()
									.toLowerCase()
									.includes(c.value.toLowerCase())
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
			U(c, (t) => {
				u("update:query", t);
			}),
				U(h, (t) => {
					t &&
						Q(() => {
							S.value.el.focus();
						});
				});
			const $ = x(() => (r.disabled ? "text-gray-600" : "text-gray-800")),
				X = x(() => {
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
				A({ query: c }),
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
							default: d(({ open: l }) => [
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
										target: d(
											({ open: o, togglePopover: P }) => [
												g(
													t.$slots,
													"target",
													V(
														C({
															open: o,
															togglePopover: P,
														})
													),
													() => [
														b("div", de, [
															b(
																"button",
																{
																	class: T([
																		"flex w-full items-center justify-between focus:outline-none",
																		X.value,
																	]),
																	onClick:
																		() =>
																			P(),
																},
																[
																	b(
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
										body: d(({ isOpen: o }) => {
											var P;
											return [
												H(
													b(
														"div",
														null,
														[
															b("div", ye, [
																b("div", ve, [
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
																						v
																					) => {
																						c.value =
																							v.target.value;
																					}),
																			value: c.value,
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
																	b(
																		"button",
																		{
																			class: "absolute right-1.5 inline-flex h-7 w-7 items-center justify-center",
																			onClick:
																				s[1] ||
																				(s[1] =
																					(
																						v
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
																			d(
																				() => [
																					(n(
																						!0
																					),
																					p(
																						R,
																						null,
																						E(
																							m.value,
																							(
																								v
																							) =>
																								H(
																									(n(),
																									p(
																										"div",
																										{
																											class: "mt-1.5",
																											key: v.key,
																										},
																										[
																											v.group &&
																											!v.hideLabel
																												? (n(),
																												  p(
																														"div",
																														be,
																														N(
																															v.group
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
																												R,
																												null,
																												E(
																													v.items,
																													(
																														B
																													) => (
																														n(),
																														F(
																															a(
																																ee
																															),
																															{
																																as: "template",
																																key: B.value,
																																value: B,
																															},
																															{
																																default:
																																	d(
																																		({
																																			active: D,
																																			selected:
																																				I,
																																		}) => [
																																			b(
																																				"li",
																																				{
																																					class: T(
																																						[
																																							"flex items-center rounded px-2.5 py-1.5 text-base",
																																							{
																																								"bg-gray-100":
																																									D,
																																							},
																																						]
																																					),
																																				},
																																				[
																																					g(
																																						t.$slots,
																																						"item-prefix",
																																						V(
																																							C(
																																								{
																																									active: D,
																																									selected:
																																										I,
																																									option: B,
																																								}
																																							)
																																						)
																																					),
																																					g(
																																						t.$slots,
																																						"item-label",
																																						V(
																																							C(
																																								{
																																									active: D,
																																									selected:
																																										I,
																																									option: B,
																																								}
																																							)
																																						),
																																						() => [
																																							te(
																																								N(
																																									B.label
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
																											v
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
																					V(
																						C(
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
		setup(j, { emit: A }) {
			const f = j,
				r = A,
				u = M(),
				c = x(() => "value" in u),
				h = x({
					get: () => (c.value ? u.value : f.modelValue),
					set: (e) =>
						(e == null ? void 0 : e.value) &&
						r(
							c.value ? "change" : "update:modelValue",
							e == null ? void 0 : e.value
						),
				}),
				S = O(null),
				k = O("");
			J(
				() => {
					var e;
					return (e = S.value) == null ? void 0 : e.query;
				},
				(e) => {
					(e = e || ""), k.value !== e && ((k.value = e), L(e));
				},
				{ debounce: 300, immediate: !0 }
			),
				J(
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
								{ key: 0, class: T(["block", _.value]) },
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
								m[0] || (m[0] = (i) => (h.value = i)),
							size: a(u).size || "sm",
							variant: a(u).variant,
							placeholder: a(u).placeholder,
							filterable: !1,
						},
						le(
							{
								target: d(({ open: i, togglePopover: y }) => [
									g(
										e.$slots,
										"target",
										V(C({ open: i, togglePopover: y }))
									),
								]),
								prefix: d(() => [g(e.$slots, "prefix")]),
								"item-prefix": d(
									({ active: i, selected: y, option: $ }) => [
										g(
											e.$slots,
											"item-prefix",
											V(
												C({
													active: i,
													selected: y,
													option: $,
												})
											)
										),
									]
								),
								"item-label": d(
									({ active: i, selected: y, option: $ }) => [
										g(
											e.$slots,
											"item-label",
											V(
												C({
													active: i,
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
											fn: d(({ value: i, close: y }) => [
												b("div", null, [
													w(
														a(re),
														{
															variant: "ghost",
															class: "w-full !justify-start",
															label: "Create New",
															onClick: ($) =>
																a(u).onCreate(
																	i,
																	y
																),
														},
														{
															prefix: d(() => [
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
export { Ve as _ };
//# sourceMappingURL=Link-4jJRdvJb.js.map
