import {
	a as k,
	Y as w,
	r as L,
	j as o,
	P as V,
	s as n,
	u as m,
	D as c,
	A as i,
	C as d,
	z as u,
	X as h,
	E as p,
	B as y,
	y as x,
	J as $,
	F as C,
	K as B,
	L as j,
	Z as z,
	$ as D,
	a0 as E,
	a1 as P,
} from "./frappe-ui.f2211ca2.js";
import { _ as U } from "./CourseCard.6a41330a.js";
import { P as A } from "./plus.8f4bce9f.js";
import "./UserAvatar.b64a03ac.js";
import "./index.43e529db.js";
import "./star.d3e8ecca.js";
const F = { class: "h-screen" },
	R = { key: 0 },
	S = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	I = { class: "flex" },
	J = { class: "mx-5 py-5" },
	K = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-5",
	},
	M = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	T = { class: "flex flex-col items-center justify-center mt-4" },
	Q = {
		__name: "Courses",
		setup(X) {
			var g, b, v;
			const l = k("$user"),
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
				f = L(0),
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
						((v = (b = a.data) == null ? void 0 : b.created) == null
							? void 0
							: v.length)) &&
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
					const N = V("router-link");
					return (
						n(),
						m("div", F, [
							c(a).data
								? (n(),
								  m("div", R, [
										i("header", S, [
											d(
												c(z),
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
											i("div", I, [
												d(
													c(D),
													{ variant: "solid" },
													{
														prefix: u(() => [
															d(c(A), {
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
										i("div", J, [
											d(
												c(P),
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
																				"group -mb-px flex items-center gap-2 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
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
																					$(
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
																				E
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
															  m("div", K, [
																	(n(!0),
																	m(
																		B,
																		null,
																		j(
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
																										U,
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
															  m("div", M, [
																	i(
																		"div",
																		T,
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
export { Q as default };
