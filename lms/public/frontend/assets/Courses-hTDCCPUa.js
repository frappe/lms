import {
	a5 as w,
	r as k,
	j as o,
	x as n,
	y as m,
	G as c,
	J as i,
	F as d,
	B as u,
	U as h,
	H as p,
	C as y,
	A as x,
	M as L,
	I as C,
	Q as V,
	R as $,
	a as B,
	W as j,
	a6 as U,
	a7 as z,
	a8 as D,
	a9 as R,
} from "./frappe-ui-iPT8hMkb.js";
import { _ as A } from "./CourseCard-1i2yp1tI.js";
import { P as E } from "./plus-_m-8cMp1.js";
import "./UserAvatar-nJqmkBPv.js";
import "./index-qZ7Yta4u.js";
import "./star-xishKgdq.js";
const F = { class: "h-screen" },
	I = { key: 0 },
	M = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	P = { class: "flex" },
	S = { class: "mx-5 py-5" },
	G = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-5",
	},
	H = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	J = { class: "flex flex-col items-center justify-center mt-4" },
	Y = {
		__name: "Courses",
		setup(Q) {
			var g, v, b;
			const l = B("$user"),
				a = w({
					type: "list",
					doctype: "LMS Course",
					cache: [
						"courses",
						(g = l == null ? void 0 : l.data) == null
							? void 0
							: g.email,
					],
					url: "lms.lms.utils.get_courses",
					auto: !0,
				}),
				f = k(0),
				_ = [
					{
						label: "Live",
						courses: o(() => {
							var e;
							return (
								((e = a.data) == null ? void 0 : e.live) || []
							);
						}),
						count: o(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.live) == null
								? void 0
								: s.length;
						}),
					},
					{
						label: "Upcoming",
						courses: o(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.upcoming;
						}),
						count: o(() => {
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
				l.data &&
					(_.push({
						label: "Enrolled",
						courses: o(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.enrolled;
						}),
						count: o(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.enrolled) ==
								null
								? void 0
								: s.length;
						}),
					}),
					(l.data.is_moderator ||
						l.data.is_instructor ||
						((b = (v = a.data) == null ? void 0 : v.created) !=
							null &&
							b.length)) &&
						_.push({
							label: "Created",
							courses: o(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.created;
							}),
							count: o(() => {
								var e, s;
								return (s =
									(e = a.data) == null
										? void 0
										: e.created) == null
									? void 0
									: s.length;
							}),
						}),
					l.data.is_moderator &&
						_.push({
							label: "Under Review",
							courses: o(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.under_review;
							}),
							count: o(() => {
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
					const N = j("router-link");
					return (
						n(),
						m("div", F, [
							c(a).data
								? (n(),
								  m("div", I, [
										i("header", M, [
											d(
												c(U),
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
											i("div", P, [
												d(
													c(z),
													{ variant: "solid" },
													{
														prefix: u(() => [
															d(c(E), {
																class: "h-4 w-4",
															}),
														]),
														default: u(() => [
															h(
																" " +
																	p(
																		e.__(
																			"New Course"
																		)
																	),
																1
															),
														]),
														_: 1,
													}
												),
											]),
										]),
										i("div", S, [
											d(
												c(R),
												{
													class: "overflow-hidden",
													modelValue: f.value,
													"onUpdate:modelValue":
														s[0] ||
														(s[0] = (r) =>
															(f.value = r)),
													tabs: _,
												},
												{
													tab: u(
														({
															tab: r,
															selected: t,
														}) => [
															i("div", null, [
																i(
																	"button",
																	{
																		class: y(
																			[
																				"group -mb-px flex items-center gap-2 overflow-hidden border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
																				{
																					"text-gray-900":
																						t,
																				},
																			]
																		),
																	},
																	[
																		r.icon
																			? (n(),
																			  x(
																					L(
																						r.icon
																					),
																					{
																						key: 0,
																						class: "h-5",
																					}
																			  ))
																			: C(
																					"",
																					!0
																			  ),
																		h(
																			" " +
																				p(
																					e.__(
																						r.label
																					)
																				) +
																				" ",
																			1
																		),
																		d(
																			c(
																				D
																			),
																			{
																				class: y(
																					{
																						"text-gray-900 border border-gray-900":
																							t,
																					}
																				),
																				variant:
																					"subtle",
																				theme: "gray",
																				size: "sm",
																			},
																			{
																				default:
																					u(
																						() => [
																							h(
																								p(
																									r.count
																								),
																								1
																							),
																						]
																					),
																				_: 2,
																			},
																			1032,
																			[
																				"class",
																			]
																		),
																	],
																	2
																),
															]),
														]
													),
													default: u(({ tab: r }) => [
														r.courses &&
														r.courses.value.length
															? (n(),
															  m("div", G, [
																	(n(!0),
																	m(
																		V,
																		null,
																		$(
																			r
																				.courses
																				.value,
																			(
																				t
																			) => (
																				n(),
																				x(
																					N,
																					{
																						to:
																							t.membership &&
																							t.current_lesson
																								? {
																										name: "Lesson",
																										params: {
																											courseName:
																												t.name,
																											chapterNumber:
																												t.current_lesson.split(
																													"."
																												)[0],
																											lessonNumber:
																												t.current_lesson.split(
																													"."
																												)[1],
																										},
																								  }
																								: t.membership
																								? {
																										name: "Lesson",
																										params: {
																											courseName:
																												t.name,
																											chapterNumber: 1,
																											lessonNumber: 1,
																										},
																								  }
																								: {
																										name: "CourseDetail",
																										params: {
																											courseName:
																												t.name,
																										},
																								  },
																					},
																					{
																						default:
																							u(
																								() => [
																									d(
																										A,
																										{
																											course: t,
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
															  ]))
															: (n(),
															  m("div", H, [
																	i(
																		"div",
																		J,
																		[
																			i(
																				"div",
																				null,
																				p(
																					e
																						.__(
																							"No {0} courses found"
																						)
																						.format(
																							r.label.toLowerCase()
																						)
																				),
																				1
																			),
																		]
																	),
															  ])),
													]),
													_: 1,
												},
												8,
												["modelValue"]
											),
										]),
								  ]))
								: C("", !0),
						])
					);
				}
			);
		},
	};
export { Y as default };
//# sourceMappingURL=Courses-hTDCCPUa.js.map
