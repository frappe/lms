import {
	af as N,
	r as b,
	k as B,
	x as e,
	y as n,
	C as r,
	I as l,
	J as p,
	Q as k,
	R as f,
	A as i,
	B as u,
	G as m,
	H as t,
	F as x,
	ah as M,
	U as H,
	ai as I,
	aj as V,
	X as j,
} from "./frappe-ui-20hnMCM8.js";
import { a as d } from "./index-Vx7mSx23.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const O = d("ChevronRightIcon", [
	["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const R = d("FileTextIcon", [
	[
		"path",
		{
			d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z",
			key: "1nnpy2",
		},
	],
	["polyline", { points: "14 2 14 8 20 8", key: "1ew0cm" }],
	["line", { x1: "16", x2: "8", y1: "13", y2: "13", key: "14keom" }],
	["line", { x1: "16", x2: "8", y1: "17", y2: "17", key: "17nazh" }],
	["line", { x1: "10", x2: "8", y1: "9", y2: "9", key: "1a5vjj" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const z = d("HelpCircleIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
	["path", { d: "M12 17h.01", key: "p32p05" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const F = d("MonitorPlayIcon", [
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
	L = { class: "text-base" },
	q = { key: 0, class: "flex justify-between mb-4" },
	T = { class: "text-2xl font-semibold" },
	P = { class: "text-base text-left font-medium" },
	Q = { class: "ml-auto text-sm" },
	S = { class: "outline-lesson py-2 pl-8" },
	A = { class: "flex items-center text-sm" },
	J = {
		__name: "CourseOutline",
		props: {
			courseName: { type: String, required: !0 },
			showOutline: { type: Boolean, default: !1 },
			showHeader: { type: Boolean, default: !1 },
		},
		setup(c) {
			const _ = N();
			b(!0);
			const y = c,
				v = B({
					url: "lms.lms.utils.get_course_outline",
					cache: ["course_outline", y.courseName],
					params: { course: y.courseName },
					auto: !0,
				}),
				w = (a) => a == _.params.chapterNumber || a == 1;
			return (a, D) => {
				const g = j("router-link");
				return (
					e(),
					n("div", L, [
						c.showHeader
							? (e(),
							  n("div", q, [
									r("div", T, l(a.__("Course Content")), 1),
							  ]))
							: p("", !0),
						r(
							"div",
							{
								class: x({
									"shadow rounded-md pt-2 px-2":
										c.showOutline,
								}),
							},
							[
								(e(!0),
								n(
									k,
									null,
									f(
										t(v).data,
										(o, C) => (
											e(),
											i(
												t(V),
												{
													key: o.name,
													defaultOpen: w(o.idx),
												},
												{
													default: u(
														({ open: h }) => [
															m(
																t(M),
																{
																	ref_for: !0,
																	ref: "",
																	class: "flex w-full px-2 py-4",
																},
																{
																	default: u(
																		() => [
																			m(
																				t(
																					O
																				),
																				{
																					class: x(
																						[
																							{
																								"rotate-90 transform duration-200":
																									h,
																								"duration-200":
																									!h,
																								open:
																									C ==
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
																			r(
																				"div",
																				P,
																				l(
																					o.title
																				),
																				1
																			),
																			r(
																				"div",
																				Q,
																				l(
																					o
																						.lessons
																						.length
																				) +
																					" " +
																					l(
																						o
																							.lessons
																							.length ==
																							1
																							? a.__(
																									"lesson"
																							  )
																							: a.__(
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
															m(
																t(I),
																{
																	class: "pb-2",
																},
																{
																	default: u(
																		() => [
																			(e(
																				!0
																			),
																			n(
																				k,
																				null,
																				f(
																					o.lessons,
																					(
																						s
																					) => (
																						e(),
																						n(
																							"div",
																							{
																								key: s.name,
																							},
																							[
																								r(
																									"div",
																									S,
																									[
																										m(
																											g,
																											{
																												to: {
																													name: "Lesson",
																													params: {
																														courseName:
																															c.courseName,
																														chapterNumber:
																															s.number.split(
																																"."
																															)[0],
																														lessonNumber:
																															s.number.split(
																																"."
																															)[1],
																													},
																												},
																											},
																											{
																												default:
																													u(
																														() => [
																															r(
																																"div",
																																A,
																																[
																																	s.icon ===
																																	"icon-youtube"
																																		? (e(),
																																		  i(
																																				t(
																																					F
																																				),
																																				{
																																					key: 0,
																																					class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																				}
																																		  ))
																																		: s.icon ===
																																		  "icon-quiz"
																																		? (e(),
																																		  i(
																																				t(
																																					z
																																				),
																																				{
																																					key: 1,
																																					class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																				}
																																		  ))
																																		: s.icon ===
																																		  "icon-list"
																																		? (e(),
																																		  i(
																																				t(
																																					R
																																				),
																																				{
																																					key: 2,
																																					class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																				}
																																		  ))
																																		: p(
																																				"",
																																				!0
																																		  ),
																																	H(
																																		" " +
																																			l(
																																				s.title
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
					])
				);
			};
		},
	};
export { O as C, J as _ };
//# sourceMappingURL=CourseOutline-M5G5Rx7O.js.map
