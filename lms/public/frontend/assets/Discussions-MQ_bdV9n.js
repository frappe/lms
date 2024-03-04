import {
	aa as N,
	ab as B,
	r as $,
	d as S,
	s as j,
	k,
	x as i,
	y,
	J as n,
	G as x,
	K as t,
	a7 as T,
	H as s,
	L as d,
	M as R,
	Q as M,
	R as E,
	F as V,
	N as F,
	a4 as D,
	aq as P,
	I,
	a as A,
	ai as G,
	D as J,
	b as K,
} from "./frappe-ui-n1bXVQkV.js";
import { _ as L } from "./UserAvatar-3mSOKoKa.js";
import { a as q, t as H, c as O } from "./index-xt-hKVBz.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Q = q("ChevronLeftIcon", [
	["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const W = q("MessageSquareIcon", [
	[
		"path",
		{
			d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
			key: "1lielz",
		},
	],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const X = q("MoreHorizontalIcon", [
		["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
		["circle", { cx: "19", cy: "12", r: "1", key: "1wjl8i" }],
		["circle", { cx: "5", cy: "12", r: "1", key: "1pcz8c" }],
	]),
	Y = { class: "mt-6" },
	Z = { key: 0, class: "flex items-center mb-5" },
	ee = { class: "text-lg font-semibold ml-2" },
	te = { class: "flex items-center justify-between mb-2" },
	se = { class: "flex items-center" },
	oe = { class: "text-sm ml-2" },
	ae = { key: 1 },
	le = { class: "flex justify-between mt-2" },
	re = s("span", null, null, -1),
	z = {
		__name: "DiscussionReplies",
		props: N(
			{
				topic: { type: Object, required: !0 },
				singleThread: { type: Boolean, default: !1 },
			},
			{ showTopics: {}, showTopicsModifiers: {} }
		),
		emits: ["update:showTopics"],
		setup(l) {
			const g = B(l, "showTopics"),
				m = $(""),
				c = S("$socket"),
				_ = S("$user"),
				p = l;
			j(() => {
				c.on("publish_message", (e) => {
					o.reload();
				}),
					c.on("update_message", (e) => {
						o.reload();
					}),
					c.on("delete_message", (e) => {
						o.reload();
					});
			});
			const o = k({
					url: "lms.lms.utils.get_discussion_replies",
					cache: ["replies", p.topic],
					makeParams(e) {
						return { topic: p.topic.name };
					},
					auto: !0,
				}),
				f = k({
					url: "frappe.client.insert",
					makeParams(e) {
						return {
							doc: {
								doctype: "Discussion Reply",
								reply: m.value,
								topic: p.topic.name,
							},
						};
					},
				}),
				h = () => {
					f.submit(
						{},
						{
							validate() {
								if (!m.value) return "Reply cannot be empty";
							},
							onSuccess() {
								(m.value = ""), o.reload();
							},
							onError(e) {
								var v;
								O({
									title: "Error",
									text:
										((v = e.messages) == null
											? void 0
											: v[0]) || e,
									icon: "x",
									iconClasses:
										"bg-red-600 text-white rounded-md p-px",
									position: "top-center",
									timeout: 10,
								});
							},
						}
					);
				},
				r = k({
					url: "frappe.client.set_value",
					makeParams(e) {
						return {
							doctype: "Discussion Reply",
							name: e.name,
							fieldname: "reply",
							value: e.reply,
						};
					},
				}),
				b = (e) => {
					r.submit(
						{ name: e.name, reply: e.reply },
						{
							validate() {
								if (!e.reply) return "Reply cannot be empty";
							},
							onSuccess() {
								(e.editable = !1), o.reload();
							},
						}
					);
				},
				w = k({
					url: "frappe.client.delete",
					makeParams(e) {
						return { doctype: "Discussion Reply", name: e.name };
					},
				}),
				u = (e) => {
					w.submit(
						{ name: e.name },
						{
							onSuccess() {
								o.reload();
							},
						}
					);
				};
			return (e, v) => (
				i(),
				y("div", Y, [
					l.singleThread
						? R("", !0)
						: (i(),
						  y("div", Z, [
								n(
									t(T),
									{
										variant: "outline",
										onClick:
											v[0] ||
											(v[0] = (a) => (g.value = !0)),
									},
									{
										icon: x(() => [
											n(t(Q), {
												class: "w-5 h-5 stroke-1.5 text-gray-700",
											}),
										]),
										_: 1,
									}
								),
								s("span", ee, d(l.topic.title), 1),
						  ])),
					(i(!0),
					y(
						M,
						null,
						E(
							t(o).data,
							(a, U) => (
								i(),
								y("div", null, [
									s(
										"div",
										{
											class: I([
												"py-3",
												{
													"border-b":
														U + 1 !=
														t(o).data.length,
												},
											]),
										},
										[
											s("div", te, [
												s("div", se, [
													n(
														L,
														{
															user: a.user,
															class: "mr-2",
														},
														null,
														8,
														["user"]
													),
													s(
														"span",
														null,
														d(a.user.full_name),
														1
													),
													s(
														"span",
														oe,
														d(t(H)(a.creation)),
														1
													),
												]),
												t(_).data.name == a.owner &&
												!a.editable
													? (i(),
													  V(
															t(F),
															{
																key: 0,
																options: [
																	{
																		label: "Edit",
																		onClick() {
																			a.editable =
																				!0;
																		},
																	},
																	{
																		label: "Delete",
																		onClick() {
																			u(
																				a
																			);
																		},
																	},
																],
															},
															{
																default: x(
																	({
																		open: C,
																	}) => [
																		n(
																			t(
																				X
																			),
																			{
																				class: "w-4 h-4 stroke-1.5 cursor-pointer",
																			}
																		),
																	]
																),
																_: 2,
															},
															1032,
															["options"]
													  ))
													: R("", !0),
												a.editable
													? (i(),
													  y("div", ae, [
															n(
																t(T),
																{
																	variant:
																		"ghost",
																	onClick: (
																		C
																	) => b(a),
																},
																{
																	default: x(
																		() => [
																			D(
																				d(
																					e.__(
																						"Post"
																					)
																				),
																				1
																			),
																		]
																	),
																	_: 2,
																},
																1032,
																["onClick"]
															),
															n(
																t(T),
																{
																	variant:
																		"ghost",
																	onClick: (
																		C
																	) =>
																		(a.editable =
																			!1),
																},
																{
																	default: x(
																		() => [
																			D(
																				d(
																					e.__(
																						"Discard"
																					)
																				),
																				1
																			),
																		]
																	),
																	_: 2,
																},
																1032,
																["onClick"]
															),
													  ]))
													: R("", !0),
											]),
											n(
												t(P),
												{
													content: a.reply,
													onChange: (C) =>
														(a.reply = C),
													editable: a.editable || !1,
													fixedMenu: a.editable || !1,
													editorClass: a.editable
														? "ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none"
														: "prose-sm",
												},
												null,
												8,
												[
													"content",
													"onChange",
													"editable",
													"fixedMenu",
													"editorClass",
												]
											),
										],
										2
									),
								])
							)
						),
						256
					)),
					n(
						t(P),
						{
							class: "mt-5",
							content: m.value,
							onChange: v[1] || (v[1] = (a) => (m.value = a)),
							placeholder: "Type your reply here...",
							fixedMenu: !0,
							editorClass:
								"ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none border border-gray-300 rounded-b-md min-h-[7rem] py-1 px-2",
						},
						null,
						8,
						["content"]
					),
					s("div", le, [
						re,
						n(
							t(T),
							{ onClick: v[2] || (v[2] = (a) => h()) },
							{
								default: x(() => [
									s("span", null, d(e.__("Post")), 1),
								]),
								_: 1,
							}
						),
					]),
				])
			);
		},
	},
	ne = { class: "flex flex-col gap-4" },
	ie = { class: "mb-1.5 text-sm text-gray-600" },
	de = { class: "mb-1.5 text-sm text-gray-600" },
	ce = {
		__name: "DiscussionModal",
		props: N(
			{
				title: { type: String, required: !0 },
				doctype: { type: String, required: !0 },
				docname: { type: String, required: !0 },
			},
			{ reloadTopics: {}, reloadTopicsModifiers: {} }
		),
		emits: ["update:reloadTopics"],
		setup(l) {
			const g = B(l, "reloadTopics"),
				m = l,
				c = A({ title: "", reply: "" }),
				_ = k({
					url: "frappe.client.insert",
					makeParams(f) {
						return {
							doc: {
								doctype: "Discussion Topic",
								reference_doctype: m.doctype,
								reference_docname: m.docname,
								title: c.title,
							},
						};
					},
				}),
				p = k({
					url: "frappe.client.insert",
					makeParams(f) {
						return {
							doc: {
								doctype: "Discussion Reply",
								topic: f.topic,
								reply: c.reply,
							},
						};
					},
				}),
				o = (f) => {
					_.submit(
						{},
						{
							onSuccess(h) {
								p.submit(
									{ topic: h.name },
									{
										onSuccess() {
											(c.title = ""),
												(c.reply = ""),
												g.value.reload(),
												f();
										},
									}
								);
							},
						}
					);
				};
			return (f, h) => (
				i(),
				V(
					t(J),
					{
						options: {
							title: m.title,
							size: "2xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (r) => o(r),
								},
							],
						},
					},
					{
						"body-content": x(() => [
							s("div", ne, [
								s("div", null, [
									s("div", ie, d(f.__("Title")), 1),
									n(
										t(G),
										{
											type: "text",
											modelValue: c.title,
											"onUpdate:modelValue":
												h[0] ||
												(h[0] = (r) => (c.title = r)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								s("div", null, [
									s("div", de, d(f.__("Details")), 1),
									n(
										t(P),
										{
											content: c.reply,
											onChange:
												h[1] ||
												(h[1] = (r) => (c.reply = r)),
											editable: !0,
											fixedMenu: !0,
											editorClass:
												"prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem]",
										},
										null,
										8,
										["content"]
									),
								]),
							]),
						]),
						_: 1,
					},
					8,
					["options"]
				)
			);
		},
	},
	ue = { class: "text-xl font-semibold" },
	pe = { key: 0 },
	me = ["onClick"],
	ye = { class: "text-lg font-semibold mb-1" },
	fe = { class: "flex items-center" },
	he = { class: "text-sm ml-2" },
	be = { key: 1 },
	ve = { key: 1 },
	ge = { key: 2, class: "flex justify-center border mt-5 p-5 rounded-md" },
	_e = { class: "text-xl font-semibold mb-2" },
	we = {
		__name: "Discussions",
		props: {
			title: { type: String, required: !0 },
			doctype: { type: String, required: !0 },
			docname: { type: String, required: !0 },
			emptyStateTitle: { type: String, default: "No topics yet" },
			emptyStateText: {
				type: String,
				default: "Be the first to start a discussion",
			},
			singleThread: { type: Boolean, default: !1 },
		},
		setup(l) {
			const g = $(!0),
				m = $(null),
				c = S("$socket"),
				_ = $(!1),
				p = l;
			j(() => {
				c.on("new_discussion_topic", (r) => {
					o.refresh();
				});
			});
			const o = k({
					url: "lms.lms.utils.get_discussion_topics",
					cache: ["topics", p.doctype, p.docname],
					makeParams() {
						return {
							doctype: p.doctype,
							docname: p.docname,
							single_thread: p.singleThread,
						};
					},
					auto: !0,
				}),
				f = (r) => {
					(g.value = !1), (m.value = r);
				},
				h = () => {
					_.value = !0;
				};
			return (r, b) => {
				var w;
				return (
					i(),
					y(
						M,
						null,
						[
							s("div", null, [
								l.singleThread
									? R("", !0)
									: (i(),
									  V(
											t(T),
											{
												key: 0,
												class: "float-right",
												onClick:
													b[0] || (b[0] = (u) => h()),
											},
											{
												default: x(() => [
													D(
														d(
															r
																.__("New {0}")
																.format(l.title)
														),
														1
													),
												]),
												_: 1,
											}
									  )),
								s("div", ue, d(r.__(l.title)), 1),
							]),
							(w = t(o).data) != null &&
							w.length &&
							!l.singleThread
								? (i(),
								  y("div", pe, [
										g.value
											? (i(!0),
											  y(
													M,
													{ key: 0 },
													E(
														t(o).data,
														(u, e) => (
															i(),
															y("div", null, [
																s(
																	"div",
																	{
																		onClick:
																			(
																				v
																			) =>
																				f(
																					u
																				),
																		class: I(
																			[
																				"flex items-center cursor-pointer py-5",
																				{
																					"border-b":
																						e +
																							1 !=
																						t(
																							o
																						)
																							.data
																							.length,
																				},
																			]
																		),
																	},
																	[
																		n(
																			L,
																			{
																				user: u.user,
																				size: "2xl",
																				class: "mr-4",
																			},
																			null,
																			8,
																			[
																				"user",
																			]
																		),
																		s(
																			"div",
																			null,
																			[
																				s(
																					"div",
																					ye,
																					d(
																						u.title
																					),
																					1
																				),
																				s(
																					"div",
																					fe,
																					[
																						s(
																							"span",
																							null,
																							d(
																								u
																									.user
																									.full_name
																							),
																							1
																						),
																						s(
																							"span",
																							he,
																							d(
																								t(
																									H
																								)(
																									u.creation
																								)
																							),
																							1
																						),
																					]
																				),
																			]
																		),
																	],
																	10,
																	me
																),
															])
														)
													),
													256
											  ))
											: (i(),
											  y("div", be, [
													n(
														z,
														{
															topic: m.value,
															showTopics: g.value,
															"onUpdate:showTopics":
																b[1] ||
																(b[1] = (u) =>
																	(g.value =
																		u)),
														},
														null,
														8,
														["topic", "showTopics"]
													),
											  ])),
								  ]))
								: l.singleThread && t(o).data
								? (i(),
								  y("div", ve, [
										n(
											z,
											{
												topic: t(o).data,
												singleThread: l.singleThread,
											},
											null,
											8,
											["topic", "singleThread"]
										),
								  ]))
								: (i(),
								  y("div", ge, [
										n(t(W), {
											class: "w-10 h-10 stroke-1.5 text-gray-800 mr-2",
										}),
										s("div", null, [
											s(
												"div",
												_e,
												d(r.__(l.emptyStateTitle)),
												1
											),
											s(
												"div",
												null,
												d(r.__(l.emptyStateText)),
												1
											),
										]),
								  ])),
							n(
								ce,
								{
									modelValue: _.value,
									"onUpdate:modelValue":
										b[2] || (b[2] = (u) => (_.value = u)),
									title: r.__("New {0}").format(l.title),
									doctype: p.doctype,
									docname: p.docname,
									reloadTopics: t(o),
									"onUpdate:reloadTopics":
										b[3] ||
										(b[3] = (u) =>
											K(o) ? (o.value = u) : null),
								},
								null,
								8,
								[
									"modelValue",
									"title",
									"doctype",
									"docname",
									"reloadTopics",
								]
							),
						],
						64
					)
				);
			};
		},
	};
export { Q as C, we as _ };
//# sourceMappingURL=Discussions-MQ_bdV9n.js.map
