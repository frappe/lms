import {
	aa as V,
	ab as B,
	x as t,
	F as c,
	G as d,
	a4 as k,
	K as e,
	D as I,
	af as O,
	r as R,
	k as q,
	y as h,
	H as l,
	L as i,
	a7 as A,
	M as f,
	I as C,
	Q as _,
	R as b,
	J as p,
	aA as E,
	aB as F,
	aC as L,
	W as S,
} from "./frappe-ui-n1bXVQkV.js";
import { a as g } from "./index-xt-hKVBz.js";
import { F as z } from "./file-text-dAqD9clk.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const D = g("ChevronRightIcon", [
	["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const H = g("HelpCircleIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
	["path", { d: "M12 17h.01", key: "p32p05" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const j = g("MonitorPlayIcon", [
		["path", { d: "m10 7 5 3-5 3Z", key: "29ljg6" }],
		[
			"rect",
			{
				width: "20",
				height: "14",
				x: "2",
				y: "3",
				rx: "2",
				key: "48i651",
			},
		],
		["path", { d: "M12 17v4", key: "1riwvh" }],
		["path", { d: "M8 21h8", key: "1ev6f3" }],
	]),
	J = {
		__name: "ChapterModal",
		props: V(
			{ course: { type: String, required: !0 } },
			{ modelValue: {}, modelModifiers: {} }
		),
		emits: ["update:modelValue"],
		setup(a) {
			const y = B(a, "modelValue");
			return (r, n) => (
				t(),
				c(
					e(I),
					{
						modelValue: y.value,
						"onUpdate:modelValue":
							n[0] || (n[0] = (m) => (y.value = m)),
						options: {
							title: r.__("Add Chapter"),
							size: "lg",
							actions: [
								{
									label: r.__("Add"),
									variant: "solid",
									onClick: (m) => r.addChapter(m),
								},
							],
						},
					},
					{ "body-content": d(() => [k(" Jannat ")]), _: 1 },
					8,
					["modelValue", "options"]
				)
			);
		},
	},
	P = { class: "text-base" },
	Q = { key: 0, class: "flex items-center justify-between mb-4" },
	T = { class: "text-lg font-semibold" },
	$ = { class: "text-base text-left font-medium" },
	G = { class: "ml-auto text-sm" },
	K = { class: "outline-lesson py-2 pl-8" },
	U = { class: "flex items-center text-sm" },
	ee = {
		__name: "CourseOutline",
		props: {
			courseName: { type: String, required: !0 },
			showOutline: { type: Boolean, default: !1 },
			title: { type: String, default: "" },
			allowEdit: { type: Boolean, default: !1 },
		},
		setup(a) {
			const y = O();
			R(!0);
			const r = a,
				n = q({
					url: "lms.lms.utils.get_course_outline",
					cache: ["course_outline", r.courseName],
					params: { course: r.courseName },
					auto: !0,
				}),
				m = (s) => s == y.params.chapterNumber || s == 1;
			return (s, W) => {
				var v, x;
				const N = S("router-link");
				return (
					t(),
					h(
						_,
						null,
						[
							l("div", P, [
								a.title &&
								(((v = e(n).data) != null && v.length) ||
									a.allowEdit)
									? (t(),
									  h("div", Q, [
											l("div", T, i(s.__(a.title)), 1),
											a.allowEdit
												? (t(),
												  c(
														e(A),
														{ key: 0 },
														{
															default: d(() => [
																k(
																	i(
																		s.__(
																			"Add Chapter"
																		)
																	),
																	1
																),
															]),
															_: 1,
														}
												  ))
												: f("", !0),
									  ]))
									: f("", !0),
								l(
									"div",
									{
										class: C({
											"shadow rounded-md pt-2 px-2":
												a.showOutline &&
												((x = e(n).data) == null
													? void 0
													: x.length),
										}),
									},
									[
										(t(!0),
										h(
											_,
											null,
											b(
												e(n).data,
												(u, M) => (
													t(),
													c(
														e(L),
														{
															key: u.name,
															defaultOpen: m(
																u.idx
															),
														},
														{
															default: d(
																({
																	open: w,
																}) => [
																	p(
																		e(E),
																		{
																			ref_for:
																				!0,
																			ref: "",
																			class: "flex w-full px-2 py-4",
																		},
																		{
																			default:
																				d(
																					() => [
																						p(
																							e(
																								D
																							),
																							{
																								class: C(
																									[
																										{
																											"rotate-90 transform duration-200":
																												w,
																											"duration-200":
																												!w,
																											open:
																												M ==
																												1,
																										},
																										"h-4 w-4 text-gray-900 stroke-1 mr-2",
																									]
																								),
																							},
																							null,
																							8,
																							[
																								"class",
																							]
																						),
																						l(
																							"div",
																							$,
																							i(
																								u.title
																							),
																							1
																						),
																						l(
																							"div",
																							G,
																							i(
																								u
																									.lessons
																									.length
																							) +
																								" " +
																								i(
																									u
																										.lessons
																										.length ==
																										1
																										? s.__(
																												"lesson"
																										  )
																										: s.__(
																												"lessons"
																										  )
																								),
																							1
																						),
																					]
																				),
																			_: 2,
																		},
																		1536
																	),
																	p(
																		e(F),
																		{
																			class: "pb-2",
																		},
																		{
																			default:
																				d(
																					() => [
																						(t(
																							!0
																						),
																						h(
																							_,
																							null,
																							b(
																								u.lessons,
																								(
																									o
																								) => (
																									t(),
																									h(
																										"div",
																										{
																											key: o.name,
																										},
																										[
																											l(
																												"div",
																												K,
																												[
																													p(
																														N,
																														{
																															to: {
																																name: "Lesson",
																																params: {
																																	courseName:
																																		a.courseName,
																																	chapterNumber:
																																		o.number.split(
																																			"."
																																		)[0],
																																	lessonNumber:
																																		o.number.split(
																																			"."
																																		)[1],
																																},
																															},
																														},
																														{
																															default:
																																d(
																																	() => [
																																		l(
																																			"div",
																																			U,
																																			[
																																				o.icon ===
																																				"icon-youtube"
																																					? (t(),
																																					  c(
																																							e(
																																								j
																																							),
																																							{
																																								key: 0,
																																								class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																							}
																																					  ))
																																					: o.icon ===
																																					  "icon-quiz"
																																					? (t(),
																																					  c(
																																							e(
																																								H
																																							),
																																							{
																																								key: 1,
																																								class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																							}
																																					  ))
																																					: o.icon ===
																																					  "icon-list"
																																					? (t(),
																																					  c(
																																							e(
																																								z
																																							),
																																							{
																																								key: 2,
																																								class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																							}
																																					  ))
																																					: f(
																																							"",
																																							!0
																																					  ),
																																				k(
																																					" " +
																																						i(
																																							o.title
																																						),
																																					1
																																				),
																																			]
																																		),
																																	]
																																),
																															_: 2,
																														},
																														1032,
																														[
																															"to",
																														]
																													),
																												]
																											),
																										]
																									)
																								)
																							),
																							128
																						)),
																					]
																				),
																			_: 2,
																		},
																		1024
																	),
																]
															),
															_: 2,
														},
														1032,
														["defaultOpen"]
													)
												)
											),
											128
										)),
									],
									2
								),
							]),
							p(J, { course: a.courseName }, null, 8, ["course"]),
						],
						64
					)
				);
			};
		},
	};
export { D as C, ee as _ };
//# sourceMappingURL=CourseOutline-mDbSZeRP.js.map
