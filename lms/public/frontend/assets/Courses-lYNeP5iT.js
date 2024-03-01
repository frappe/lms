import {
	d as N,
	a5 as k,
	r as w,
	j as r,
	y as u,
	K as n,
	H as d,
	J as m,
	G as c,
	F as p,
	M as f,
	X as L,
	x as l,
	a6 as V,
	U as g,
	L as h,
	a7 as $,
	I as j,
	P as B,
	a8 as U,
	Q as D,
	R as P,
	a9 as R,
} from "./frappe-ui-LT4YqXtx.js";
import { _ as z } from "./CourseCard-RMpjQ-rq.js";
import { P as E } from "./plus-0JOmes86.js";
import "./UserAvatar-A3tEMZXD.js";
import "./index-6k1S_EjG.js";
import "./star--IkSKstT.js";
const F = { class: "h-screen" },
	I = { key: 0 },
	M = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	S = { class: "flex" },
	A = { class: "" },
	G = { key: 0, class: "p-5 text-base text-gray-700" },
	H = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 my-5 mx-5",
	},
	J = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	K = { class: "flex flex-col items-center justify-center mt-4" },
	Z = {
		__name: "Courses",
		setup(Q) {
			var b, y, x;
			const i = N("$user"),
				a = k({
					type: "list",
					doctype: "LMS Course",
					cache: [
						"courses",
						(b = i == null ? void 0 : i.data) == null
							? void 0
							: b.email,
					],
					url: "lms.lms.utils.get_courses",
					auto: !0,
				}),
				v = w(0),
				_ = [
					{
						label: "Live",
						courses: r(() => {
							var e;
							return (
								((e = a.data) == null ? void 0 : e.live) || []
							);
						}),
						count: r(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.live) == null
								? void 0
								: s.length;
						}),
					},
					{
						label: "Upcoming",
						courses: r(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.upcoming;
						}),
						count: r(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.upcoming) ==
								null
								? void 0
								: s.length;
						}),
					},
				];
			return (
				i.data &&
					(_.push({
						label: "Enrolled",
						courses: r(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.enrolled;
						}),
						count: r(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.enrolled) ==
								null
								? void 0
								: s.length;
						}),
					}),
					(i.data.is_moderator ||
						i.data.is_instructor ||
						((x = (y = a.data) == null ? void 0 : y.created) !=
							null &&
							x.length)) &&
						_.push({
							label: "Created",
							courses: r(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.created;
							}),
							count: r(() => {
								var e, s;
								return (s =
									(e = a.data) == null
										? void 0
										: e.created) == null
									? void 0
									: s.length;
							}),
						}),
					i.data.is_moderator &&
						_.push({
							label: "Under Review",
							courses: r(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.under_review;
							}),
							count: r(() => {
								var e, s;
								return (s =
									(e = a.data) == null
										? void 0
										: e.under_review) == null
									? void 0
									: s.length;
							}),
						})),
				(e, s) => {
					const C = L("router-link");
					return (
						l(),
						u("div", F, [
							n(a).data
								? (l(),
								  u("div", I, [
										d("header", M, [
											m(
												n(V),
												{
													class: "h-7",
													items: [
														{
															label: e.__(
																"All Courses"
															),
															route: {
																name: "Courses",
															},
														},
													],
												},
												null,
												8,
												["items"]
											),
											d("div", S, [
												m(
													C,
													{
														to: {
															name: "CreateCourse",
															params: {
																courseName:
																	"new",
															},
														},
													},
													{
														default: c(() => {
															var t;
															return [
																(t =
																	n(
																		i
																	).data) !=
																	null &&
																t.is_moderator
																	? (l(),
																	  p(
																			n(
																				$
																			),
																			{
																				key: 0,
																				variant:
																					"solid",
																			},
																			{
																				prefix: c(
																					() => [
																						m(
																							n(
																								E
																							),
																							{
																								class: "h-4 w-4",
																							}
																						),
																					]
																				),
																				default:
																					c(
																						() => [
																							g(
																								" " +
																									h(
																										e.__(
																											"New Course"
																										)
																									),
																								1
																							),
																						]
																					),
																				_: 1,
																			}
																	  ))
																	: f("", !0),
															];
														}),
														_: 1,
													}
												),
											]),
										]),
										d("div", A, [
											n(a).data.length == 0 &&
											n(a).list.loading
												? (l(),
												  u(
														"div",
														G,
														" Loading Courses... "
												  ))
												: (l(),
												  p(
														n(R),
														{
															key: 1,
															modelValue: v.value,
															"onUpdate:modelValue":
																s[0] ||
																(s[0] = (t) =>
																	(v.value =
																		t)),
															tabs: _,
															tablistClass:
																"overflow-x-visible",
														},
														{
															tab: c(
																({
																	tab: t,
																	selected: o,
																}) => [
																	d(
																		"div",
																		null,
																		[
																			d(
																				"button",
																				{
																					class: j(
																						[
																							"group -mb-px flex items-center gap-2 overflow-hidden border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
																							{
																								"text-gray-900":
																									o,
																							},
																						]
																					),
																				},
																				[
																					t.icon
																						? (l(),
																						  p(
																								B(
																									t.icon
																								),
																								{
																									key: 0,
																									class: "h-5",
																								}
																						  ))
																						: f(
																								"",
																								!0
																						  ),
																					g(
																						" " +
																							h(
																								e.__(
																									t.label
																								)
																							) +
																							" ",
																						1
																					),
																					m(
																						n(
																							U
																						),
																						{
																							theme: "gray",
																						},
																						{
																							default:
																								c(
																									() => [
																										g(
																											h(
																												t.count
																											),
																											1
																										),
																									]
																								),
																							_: 2,
																						},
																						1024
																					),
																				],
																				2
																			),
																		]
																	),
																]
															),
															default: c(
																({
																	tab: t,
																}) => [
																	t.courses &&
																	t.courses
																		.value
																		.length
																		? (l(),
																		  u(
																				"div",
																				H,
																				[
																					(l(
																						!0
																					),
																					u(
																						D,
																						null,
																						P(
																							t
																								.courses
																								.value,
																							(
																								o
																							) => (
																								l(),
																								p(
																									C,
																									{
																										to:
																											o.membership &&
																											o.current_lesson
																												? {
																														name: "Lesson",
																														params: {
																															courseName:
																																o.name,
																															chapterNumber:
																																o.current_lesson.split(
																																	"."
																																)[0],
																															lessonNumber:
																																o.current_lesson.split(
																																	"."
																																)[1],
																														},
																												  }
																												: o.membership
																												? {
																														name: "Lesson",
																														params: {
																															courseName:
																																o.name,
																															chapterNumber: 1,
																															lessonNumber: 1,
																														},
																												  }
																												: {
																														name: "CourseDetail",
																														params: {
																															courseName:
																																o.name,
																														},
																												  },
																									},
																									{
																										default:
																											c(
																												() => [
																													m(
																														z,
																														{
																															course: o,
																														},
																														null,
																														8,
																														[
																															"course",
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
																								)
																							)
																						),
																						256
																					)),
																				]
																		  ))
																		: (l(),
																		  u(
																				"div",
																				J,
																				[
																					d(
																						"div",
																						K,
																						[
																							d(
																								"div",
																								null,
																								h(
																									e
																										.__(
																											"No {0} courses found"
																										)
																										.format(
																											t.label.toLowerCase()
																										)
																								),
																								1
																							),
																						]
																					),
																				]
																		  )),
																]
															),
															_: 1,
														},
														8,
														["modelValue"]
												  )),
										]),
								  ]))
								: f("", !0),
						])
					);
				}
			);
		},
	};
export { Z as default };
//# sourceMappingURL=Courses-lYNeP5iT.js.map
