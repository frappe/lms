var U = Object.defineProperty;
var S = Object.getOwnPropertySymbols;
var D = Object.prototype.hasOwnProperty,
	q = Object.prototype.propertyIsEnumerable;
var L = (l, c, t) =>
		c in l
			? U(l, c, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: t,
			  })
			: (l[c] = t),
	M = (l, c) => {
		for (var t in c || (c = {})) D.call(c, t) && L(l, t, c[t]);
		if (S) for (var t of S(c)) q.call(c, t) && L(l, t, c[t]);
		return l;
	};
import {
	H as O,
	a as T,
	j as R,
	P,
	s as r,
	u as d,
	F as v,
	A as e,
	y as p,
	z as y,
	C as _,
	D as s,
	$,
	E as o,
	k as C,
	r as z,
	K as f,
	L as b,
	B as k,
	a5 as A,
	a6 as j,
	b as F,
	a7 as H,
	O as W,
	a2 as K,
	c as Z,
	Z as G,
} from "./frappe-ui.a747cf9c.js";
import { c as N } from "./index.6f049c1a.js";
import { U as B, B as I } from "./index.51e5b051.js";
import { S as x } from "./star.d358f014.js";
import { _ as J } from "./CourseOutline.2110618a.js";
import { _ as E } from "./UserAvatar.3cd4adb4.js";
const Q = { class: "shadow rounded-md", style: { width: "300px" } },
	X = ["src"],
	Y = { class: "p-5" },
	ee = { class: "flex items-center mb-3" },
	te = { class: "ml-1" },
	se = { class: "flex items-center mb-3" },
	ae = { class: "ml-1" },
	le = { class: "flex items-center" },
	oe = { class: "ml-1" },
	ne = {
		__name: "CourseCardOverlay",
		props: { course: { type: Object, default: null } },
		setup(l) {
			const c = O(),
				t = T("$user"),
				n = l,
				g = R(() =>
					n.course.data.video_link
						? "https://www.youtube.com/embed/" +
						  n.course.data.video_link
						: null
				);
			function h() {
				if (!t.data)
					N({
						title: "Please Login",
						icon: "alert-circle",
						iconClasses: "text-yellow-600 bg-yellow-100",
					}),
						setTimeout(() => {
							window.location.href = `/login?redirect-to=${window.location.pathname}`;
						}, 3e3);
				else {
					const m = C({
						url: "lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership",
					});
					console.log(n.course),
						m.submit({ course: n.course.data.name }).then(() => {
							N({
								title: "Enrolled Successfully",
								icon: "check",
								iconClasses: "text-green-600 bg-green-100",
							}),
								setTimeout(() => {
									c.push({
										name: "Lesson",
										params: {
											courseName: n.course.data.name,
											chapterNumber: 1,
											lessonNumber: 1,
										},
									});
								}, 3e3);
						});
				}
			}
			return (m, i) => {
				var a, w;
				const u = P("router-link");
				return (
					r(),
					d("div", Q, [
						l.course.data.video_link
							? (r(),
							  d(
									"iframe",
									{
										key: 0,
										src: g.value,
										class: "rounded-t-md",
									},
									null,
									8,
									X
							  ))
							: v("", !0),
						e("div", Y, [
							l.course.data.membership
								? (r(),
								  p(
										u,
										{
											key: 0,
											to: {
												name: "Lesson",
												params: {
													courseName: l.course.name,
													chapterNumber: l.course.data
														.current_lesson
														? l.course.data.current_lesson.split(
																"."
														  )[0]
														: 1,
													lessonNumber: l.course.data
														.current_lesson
														? l.course.data.current_lesson.split(
																"."
														  )[1]
														: 1,
												},
											},
										},
										{
											default: y(() => [
												_(
													s($),
													{
														variant: "solid",
														class: "w-full mb-3",
													},
													{
														default: y(() => [
															e(
																"span",
																null,
																o(
																	m.__(
																		"Continue Learning"
																	)
																),
																1
															),
														]),
														_: 1,
													}
												),
											]),
											_: 1,
										},
										8,
										["to"]
								  ))
								: (r(),
								  p(
										s($),
										{
											key: 1,
											onClick:
												i[0] || (i[0] = (V) => h()),
											variant: "solid",
											class: "w-full mb-3",
										},
										{
											default: y(() => [
												e(
													"span",
													null,
													o(m.__("Start Learning")),
													1
												),
											]),
											_: 1,
										}
								  )),
							(w = (a = s(t)) == null ? void 0 : a.data) !=
								null && w.is_moderator
								? (r(),
								  p(
										s($),
										{
											key: 2,
											variant: "subtle",
											class: "w-full mb-3",
										},
										{
											default: y(() => [
												e(
													"span",
													null,
													o(m.__("Edit")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: v("", !0),
							e("div", ee, [
								_(s(B), { class: "h-4 w-4 text-gray-700" }),
								e(
									"span",
									te,
									o(
										l.course.data.enrollment_count_formatted
									) +
										" " +
										o(m.__("Enrolled")),
									1
								),
							]),
							e("div", se, [
								_(s(I), { class: "h-4 w-4 text-gray-700" }),
								e(
									"span",
									ae,
									o(l.course.data.lesson_count) +
										" " +
										o(m.__("Lessons")),
									1
								),
							]),
							e("div", le, [
								_(s(x), {
									class: "h-4 w-4 fill-orange-500 text-gray-100",
								}),
								e(
									"span",
									oe,
									o(l.course.data.avg_rating) +
										" " +
										o(m.__("Rating")),
									1
								),
							]),
						]),
					])
				);
			};
		},
	},
	re = { class: "flex text-center" },
	ie = {
		__name: "Rating",
		props: {
			id: { type: String, default: "" },
			modelValue: { type: Number, default: 0 },
		},
		emits: ["update:modelValue"],
		setup(l, { emit: c }) {
			const t = l,
				n = c;
			let g = z(t.modelValue),
				h = (i) => {
					n("update:modelValue", i);
				};
			function m(i) {
				h(i), (g.value = i);
			}
			return (i, u) => (
				r(),
				d("div", re, [
					(r(),
					d(
						f,
						null,
						b(5, (a) =>
							e("div", null, [
								_(
									s(x),
									{
										class: k([
											{ "fill-orange-500": a <= s(g) },
											"h-5 w-5 fill-gray-400 text-gray-200 mr-1 cursor-pointer",
										]),
										onClick: (w) => m(a),
									},
									null,
									8,
									["class", "onClick"]
								),
							])
						),
						64
					)),
				])
			);
		},
	},
	ce = { class: "flex flex-col gap-4" },
	ue = { class: "mb-1.5 text-sm text-gray-600" },
	de = { class: "mb-1.5 text-sm text-gray-600" },
	me = {
		__name: "ReviewModal",
		props: A(
			{ courseName: { type: String, required: !0 } },
			{ modelValue: {}, reloadReviews: {} }
		),
		emits: ["update:modelValue", "update:reloadReviews"],
		setup(l) {
			const c = j(l, "modelValue"),
				t = j(l, "reloadReviews");
			let n = F({ review: "", rating: 0 });
			const g = l,
				h = C({
					url: "frappe.client.insert",
					makeParams(i) {
						return {
							doc: M(
								{
									doctype: "LMS Course Review",
									course: g.courseName,
								},
								i
							),
						};
					},
				});
			function m(i) {
				(n.rating = n.rating / 5),
					h.submit(n, {
						validate() {
							if (!n.rating) return "Please enter a rating.";
						},
						onSuccess() {
							t.value.reload();
						},
						onError(u) {
							var a;
							N({
								text:
									((a = u.messages) == null
										? void 0
										: a[0]) || u,
								icon: "x",
								iconClasses: "text-red-600 bg-red-300",
							});
						},
					}),
					i();
			}
			return (i, u) => (
				r(),
				p(
					s(W),
					{
						modelValue: c.value,
						"onUpdate:modelValue":
							u[2] || (u[2] = (a) => (c.value = a)),
						options: {
							title: i.__("Write a Review"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (a) => m(a),
								},
							],
						},
					},
					{
						"body-content": y(() => [
							e("div", ce, [
								e("div", null, [
									e("div", ue, o(i.__("Rating")), 1),
									_(
										ie,
										{
											modelValue: s(n).rating,
											"onUpdate:modelValue":
												u[0] ||
												(u[0] = (a) =>
													(s(n).rating = a)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								e("div", null, [
									e("div", de, o(i.__("Review")), 1),
									_(
										s(H),
										{
											type: "text",
											size: "md",
											rows: "5",
											modelValue: s(n).review,
											"onUpdate:modelValue":
												u[1] ||
												(u[1] = (a) =>
													(s(n).review = a)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
							]),
						]),
						_: 1,
					},
					8,
					["modelValue", "options"]
				)
			);
		},
	},
	_e = { key: 0, class: "my-10" },
	ve = { class: "text-2xl font-semibold mb-5" },
	ge = { class: "flex justify-between" },
	he = { class: "flex flex-col items-center" },
	fe = { key: 0, class: "text-3xl font-semibold mb-2" },
	pe = { class: "flex mb-2" },
	ye = { class: "mb-2" },
	be = e("div", { class: "border border-gray-300 mx-4" }, null, -1),
	we = { class: "flex flex-col" },
	xe = { class: "flex items-center mb-4" },
	$e = { class: "mr-2" },
	ke = { class: "bg-gray-200 rounded-full w-52 mr-2" },
	Ce = { class: "mt-12" },
	Ne = { class: "my-4" },
	Re = { class: "flex items-center" },
	Ve = { class: "mx-4" },
	Se = { class: "text-lg font-medium mr-4" },
	Le = { class: "flex mt-2" },
	Me = { class: "mt-4 leading-5" },
	je = { key: 0, class: "mx-3 h-px border-t border-gray-200" },
	ze = {
		__name: "CourseReviews",
		props: {
			courseName: { type: String, required: !0 },
			avg_rating: { type: Number, required: !0 },
			membership: { type: Object, required: !1 },
		},
		setup(l) {
			const c = l,
				t = (i) => Array.from({ length: i }, (u, a) => i - a),
				n = C({
					url: "lms.lms.utils.get_reviews",
					cache: ["course_reviews", c.courseName],
					params: { course: c.courseName },
					auto: !0,
				}),
				g = R(() => {
					let i = {},
						u = {};
					for (const a of [1, 2, 3, 4, 5]) i[a] = 0;
					for (const a of n == null ? void 0 : n.data)
						i[a.rating] += 1;
					return (
						[1, 2, 3, 4, 5].forEach((a) => {
							u[a] = ((i[a] / n.data.length) * 100).toFixed(2);
						}),
						u
					);
				}),
				h = z(!1);
			function m() {
				console.log("called"), (h.value = !0);
			}
			return (i, u) => (
				r(),
				d(
					f,
					null,
					[
						s(n).data
							? (r(),
							  d("div", _e, [
									e("div", ve, o(i.__("Reviews")), 1),
									e("div", ge, [
										e("div", he, [
											l.avg_rating
												? (r(),
												  d(
														"div",
														fe,
														o(l.avg_rating),
														1
												  ))
												: v("", !0),
											e("div", pe, [
												(r(),
												d(
													f,
													null,
													b(5, (a) =>
														_(
															s(x),
															{
																class: k([
																	"h-5 w-5 text-gray-100 bg-gray-200 rounded-sm mr-1",
																	a <=
																	Math.ceil(
																		l.avg_rating
																	)
																		? "fill-orange-500"
																		: "fill-gray-600",
																]),
															},
															null,
															8,
															["class"]
														)
													),
													64
												)),
											]),
											e(
												"div",
												ye,
												o(s(n).data.length) +
													" " +
													o(i.__("reviews")),
												1
											),
											l.membership
												? (r(),
												  p(
														s($),
														{
															key: 1,
															onClick:
																u[0] ||
																(u[0] = (a) =>
																	m()),
														},
														{
															default: y(() => [
																e(
																	"span",
																	null,
																	o(
																		i.__(
																			"Write a review"
																		)
																	),
																	1
																),
															]),
															_: 1,
														}
												  ))
												: v("", !0),
										]),
										be,
										e("div", we, [
											(r(!0),
											d(
												f,
												null,
												b(
													t(5),
													(a) => (
														r(),
														d("div", null, [
															e("div", xe, [
																e(
																	"span",
																	$e,
																	o(a) +
																		" " +
																		o(
																			i.__(
																				"stars"
																			)
																		),
																	1
																),
																e("div", ke, [
																	e(
																		"div",
																		{
																			class: "bg-gray-900 h-1 rounded-full",
																			style: K(
																				{
																					width:
																						g
																							.value[
																							a
																						] +
																						"%",
																				}
																			),
																		},
																		null,
																		4
																	),
																]),
																e(
																	"span",
																	null,
																	o(
																		Math.floor(
																			g
																				.value[
																				a
																			]
																		)
																	) + "% ",
																	1
																),
															]),
														])
													)
												),
												256
											)),
										]),
									]),
									e("div", Ce, [
										(r(!0),
										d(
											f,
											null,
											b(
												s(n).data,
												(a, w) => (
													r(),
													d("div", null, [
														e("div", Ne, [
															e("div", Re, [
																_(
																	E,
																	{
																		user: a.owner_details,
																		size: "2xl",
																	},
																	null,
																	8,
																	["user"]
																),
																e("div", Ve, [
																	e(
																		"span",
																		Se,
																		o(
																			a
																				.owner_details
																				.full_name
																		),
																		1
																	),
																	e(
																		"span",
																		null,
																		o(
																			a.creation
																		),
																		1
																	),
																	e(
																		"div",
																		Le,
																		[
																			(r(),
																			d(
																				f,
																				null,
																				b(
																					5,
																					(
																						V
																					) =>
																						_(
																							s(
																								x
																							),
																							{
																								class: k(
																									[
																										"h-5 w-5 text-gray-100 bg-gray-200 rounded-sm mr-2",
																										V <=
																										Math.ceil(
																											a.rating
																										)
																											? "fill-orange-500"
																											: "fill-gray-600",
																									]
																								),
																							},
																							null,
																							8,
																							[
																								"class",
																							]
																						)
																				),
																				64
																			)),
																		]
																	),
																]),
															]),
															e(
																"div",
																Me,
																o(a.review),
																1
															),
														]),
														w < s(n).data.length - 1
															? (r(),
															  d("div", je))
															: v("", !0),
													])
												)
											),
											256
										)),
									]),
							  ]))
							: v("", !0),
						_(
							me,
							{
								modelValue: h.value,
								"onUpdate:modelValue":
									u[1] || (u[1] = (a) => (h.value = a)),
								reloadReviews: s(n),
								"onUpdate:reloadReviews":
									u[2] ||
									(u[2] = (a) =>
										Z(n) ? (n.value = a) : null),
								courseName: l.courseName,
							},
							null,
							8,
							["modelValue", "reloadReviews", "courseName"]
						),
					],
					64
				)
			);
		},
	};
const Be = { key: 0, class: "h-screen text-base" },
	Ee = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	Ue = { class: "m-5" },
	De = { class: "text-3xl font-semibold" },
	qe = { class: "my-3" },
	Oe = { class: "flex items-center justify-between w-1/3" },
	Te = { key: 0, class: "flex items-center" },
	Pe = { class: "ml-1" },
	Ae = { key: 1 },
	Fe = { key: 2, class: "flex items-center" },
	He = { class: "ml-1" },
	We = { key: 3 },
	Ke = { class: "flex items-center" },
	Ze = { key: 0 },
	Ge = { key: 1 },
	Ie = { key: 2 },
	Je = { class: "grid grid-cols-[60%,20%] gap-20 mt-10" },
	Qe = { class: "" },
	Xe = ["innerHTML"],
	Ye = { class: "mt-10" },
	et = { class: "text-2xl font-semibold" },
	it = {
		__name: "CourseDetail",
		props: { courseName: { type: String, required: !0 } },
		setup(l) {
			const c = l,
				t = C({
					url: "lms.lms.utils.get_course_details",
					cache: ["course", c.courseName],
					params: { course: c.courseName },
					auto: !0,
				}),
				n = R(() => {
					var h, m;
					let g = [
						{ label: "All Courses", route: { name: "Courses" } },
					];
					return (
						g.push({
							label:
								(h = t == null ? void 0 : t.data) == null
									? void 0
									: h.title,
							route: {
								name: "CourseDetail",
								params: {
									course:
										(m = t == null ? void 0 : t.data) ==
										null
											? void 0
											: m.name,
								},
							},
						}),
						g
					);
				});
			return (g, h) =>
				s(t).data
					? (r(),
					  d("div", Be, [
							e("header", Ee, [
								_(
									s(G),
									{ class: "h-7", items: n.value },
									null,
									8,
									["items"]
								),
							]),
							e("div", Ue, [
								e("div", null, [
									e("div", De, o(s(t).data.title), 1),
									e(
										"div",
										qe,
										o(s(t).data.short_introduction),
										1
									),
									e("div", Oe, [
										s(t).data.avg_rating
											? (r(),
											  d("div", Te, [
													_(s(x), {
														class: "h-5 w-5 text-gray-100 fill-orange-500",
													}),
													e(
														"span",
														Pe,
														o(s(t).data.avg_rating),
														1
													),
											  ]))
											: v("", !0),
										s(t).data.avg_rating
											? (r(), d("span", Ae, "\xB7"))
											: v("", !0),
										s(t).data.enrollment_count
											? (r(),
											  d("div", Fe, [
													_(s(B), {
														class: "h-4 w-4 text-gray-700",
													}),
													e(
														"span",
														He,
														o(
															s(t).data
																.enrollment_count_formatted
														),
														1
													),
											  ]))
											: v("", !0),
										s(t).data.enrollment_count
											? (r(), d("span", We, "\xB7"))
											: v("", !0),
										e("div", Ke, [
											e(
												"span",
												{
													class: k([
														"mr-1",
														{
															"avatar-group overlap":
																s(t).data
																	.instructors
																	.length > 1,
														},
													]),
												},
												[
													(r(!0),
													d(
														f,
														null,
														b(
															s(t).data
																.instructors,
															(m) => (
																r(),
																p(
																	E,
																	{ user: m },
																	null,
																	8,
																	["user"]
																)
															)
														),
														256
													)),
												],
												2
											),
											s(t).data.instructors.length == 1
												? (r(),
												  d(
														"span",
														Ze,
														o(
															s(t).data
																.instructors[0]
																.full_name
														),
														1
												  ))
												: v("", !0),
											s(t).data.instructors.length == 2
												? (r(),
												  d(
														"span",
														Ge,
														o(
															s(t).data
																.instructors[0]
																.first_name
														) +
															" and " +
															o(
																s(t).data
																	.instructors[1]
																	.first_name
															),
														1
												  ))
												: v("", !0),
											s(t).data.instructors.length > 2
												? (r(),
												  d(
														"span",
														Ie,
														o(
															s(t).data
																.instructors[0]
																.first_name
														) +
															" and " +
															o(
																s(t).data
																	.instructors
																	.length - 1
															) +
															" others ",
														1
												  ))
												: v("", !0),
										]),
									]),
								]),
								e("div", Je, [
									e("div", Qe, [
										e(
											"div",
											{
												innerHTML:
													s(t).data.description,
												class: "course-description",
											},
											null,
											8,
											Xe
										),
										e("div", Ye, [
											e(
												"div",
												et,
												o(g.__("Course Content")),
												1
											),
											_(
												J,
												{ courseName: s(t).data.name },
												null,
												8,
												["courseName"]
											),
										]),
										s(t).data.avg_rating
											? (r(),
											  p(
													ze,
													{
														key: 0,
														courseName:
															s(t).data.name,
														avg_rating:
															s(t).data
																.avg_rating,
														membership:
															s(t).data
																.membership,
													},
													null,
													8,
													[
														"courseName",
														"avg_rating",
														"membership",
													]
											  ))
											: v("", !0),
									]),
									e("div", null, [
										_(ne, { course: s(t) }, null, 8, [
											"course",
										]),
									]),
								]),
							]),
					  ]))
					: v("", !0);
		},
	};
export { it as default };
