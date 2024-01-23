var E = Object.defineProperty;
var S = Object.getOwnPropertySymbols;
var q = Object.prototype.hasOwnProperty,
	D = Object.prototype.propertyIsEnumerable;
var M = (l, c, s) =>
		c in l
			? E(l, c, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: s,
			  })
			: (l[c] = s),
	L = (l, c) => {
		for (var s in c || (c = {})) q.call(c, s) && M(l, s, c[s]);
		if (S) for (var s of S(c)) D.call(c, s) && M(l, s, c[s]);
		return l;
	};
import {
	L as T,
	a as O,
	j as C,
	W as A,
	x as n,
	y as d,
	I as v,
	J as e,
	A as p,
	B as h,
	a7 as x,
	G as t,
	H as o,
	F as _,
	k as R,
	r as j,
	Q as y,
	R as b,
	C as k,
	aa as F,
	ab as B,
	b as H,
	ac as P,
	D as W,
	V as G,
	c as I,
	a6 as J,
} from "./frappe-ui-iPT8hMkb.js";
import { U, B as Q, c as N } from "./index-qZ7Yta4u.js";
import { S as $ } from "./star-xishKgdq.js";
import { _ as K } from "./CourseOutline-7cUm8E8p.js";
import { _ as z } from "./UserAvatar-nJqmkBPv.js";
const X = { class: "shadow rounded-md", style: { width: "300px" } },
	Y = ["src"],
	Z = { class: "p-5" },
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
			const c = T(),
				s = O("$user"),
				r = l,
				g = C(() =>
					r.course.data.video_link
						? "https://www.youtube.com/embed/" +
						  r.course.data.video_link
						: null
				);
			function f() {
				if (!s.data)
					N({
						title: "Please Login",
						icon: "alert-circle",
						iconClasses: "text-yellow-600 bg-yellow-100",
					}),
						setTimeout(() => {
							window.location.href = `/login?redirect-to=${window.location.pathname}`;
						}, 3e3);
				else {
					const m = R({
						url: "lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership",
					});
					console.log(r.course),
						m.submit({ course: r.course.data.name }).then(() => {
							N({
								title: "Enrolled Successfully",
								icon: "check",
								iconClasses: "text-green-600 bg-green-100",
							}),
								setTimeout(() => {
									c.push({
										name: "Lesson",
										params: {
											courseName: r.course.data.name,
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
				const u = A("router-link");
				return (
					n(),
					d("div", X, [
						l.course.data.video_link
							? (n(),
							  d(
									"iframe",
									{
										key: 0,
										src: g.value,
										class: "rounded-t-md",
									},
									null,
									8,
									Y
							  ))
							: v("", !0),
						e("div", Z, [
							l.course.data.membership
								? (n(),
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
											default: h(() => [
												_(
													t(x),
													{
														variant: "solid",
														class: "w-full mb-3",
													},
													{
														default: h(() => [
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
								: l.course.data.paid_course
								? (n(),
								  p(
										u,
										{
											key: 1,
											to: {
												name: "Billing",
												params: {
													type: "course",
													name: l.course.data.name,
												},
											},
										},
										{
											default: h(() => [
												_(
													t(x),
													{
														variant: "solid",
														class: "w-full mb-3",
													},
													{
														default: h(() => [
															e(
																"span",
																null,
																o(
																	m.__(
																		"Buy this course"
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
								: (n(),
								  p(
										t(x),
										{
											key: 2,
											onClick:
												i[0] || (i[0] = (V) => f()),
											variant: "solid",
											class: "w-full mb-3",
										},
										{
											default: h(() => [
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
							(w = (a = t(s)) == null ? void 0 : a.data) !=
								null && w.is_moderator
								? (n(),
								  p(
										t(x),
										{
											key: 3,
											variant: "subtle",
											class: "w-full mb-3",
										},
										{
											default: h(() => [
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
								_(t(U), { class: "h-4 w-4 text-gray-700" }),
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
								_(t(Q), { class: "h-4 w-4 text-gray-700" }),
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
								_(t($), {
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
			const s = l,
				r = c;
			let g = j(s.modelValue),
				f = (i) => {
					r("update:modelValue", i);
				};
			function m(i) {
				f(i), (g.value = i);
			}
			return (i, u) => (
				n(),
				d("div", re, [
					(n(),
					d(
						y,
						null,
						b(5, (a) =>
							e("div", null, [
								_(
									t($),
									{
										class: k([
											{ "fill-orange-500": a <= t(g) },
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
	ue = { class: "flex flex-col gap-4" },
	ce = { class: "mb-1.5 text-sm text-gray-600" },
	de = { class: "mb-1.5 text-sm text-gray-600" },
	me = {
		__name: "ReviewModal",
		props: F(
			{ courseName: { type: String, required: !0 } },
			{
				modelValue: {},
				modelModifiers: {},
				reloadReviews: {},
				reloadReviewsModifiers: {},
			}
		),
		emits: ["update:modelValue", "update:reloadReviews"],
		setup(l) {
			const c = B(l, "modelValue"),
				s = B(l, "reloadReviews");
			let r = H({ review: "", rating: 0 });
			const g = l,
				f = R({
					url: "frappe.client.insert",
					makeParams(i) {
						return {
							doc: L(
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
				(r.rating = r.rating / 5),
					f.submit(r, {
						validate() {
							if (!r.rating) return "Please enter a rating.";
						},
						onSuccess() {
							s.value.reload();
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
				n(),
				p(
					t(W),
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
						"body-content": h(() => [
							e("div", ue, [
								e("div", null, [
									e("div", ce, o(i.__("Rating")), 1),
									_(
										ie,
										{
											modelValue: t(r).rating,
											"onUpdate:modelValue":
												u[0] ||
												(u[0] = (a) =>
													(t(r).rating = a)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								e("div", null, [
									e("div", de, o(i.__("Review")), 1),
									_(
										t(P),
										{
											type: "text",
											size: "md",
											rows: "5",
											modelValue: t(r).review,
											"onUpdate:modelValue":
												u[1] ||
												(u[1] = (a) =>
													(t(r).review = a)),
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
	fe = { class: "flex flex-col items-center" },
	he = { key: 0, class: "text-3xl font-semibold mb-2" },
	pe = { class: "flex mb-2" },
	ye = { class: "mb-2" },
	be = e("div", { class: "border border-gray-300 mx-4" }, null, -1),
	we = { class: "flex flex-col" },
	xe = { class: "flex items-center mb-4" },
	$e = { class: "mr-2" },
	ke = { class: "bg-gray-200 rounded-full w-52 mr-2" },
	Re = { class: "mt-12" },
	Ne = { class: "my-4" },
	Ce = { class: "flex items-center" },
	Ve = { class: "mx-4" },
	Se = { class: "text-lg font-medium mr-4" },
	Me = { class: "flex mt-2" },
	Le = { class: "mt-4 leading-5" },
	Be = { key: 0, class: "mx-3 h-px border-t border-gray-200" },
	je = {
		__name: "CourseReviews",
		props: {
			courseName: { type: String, required: !0 },
			avg_rating: { type: Number, required: !0 },
			membership: { type: Object, required: !1 },
		},
		setup(l) {
			const c = l,
				s = (i) => Array.from({ length: i }, (u, a) => i - a),
				r = R({
					url: "lms.lms.utils.get_reviews",
					cache: ["course_reviews", c.courseName],
					params: { course: c.courseName },
					auto: !0,
				}),
				g = C(() => {
					let i = {},
						u = {};
					for (const a of [1, 2, 3, 4, 5]) i[a] = 0;
					for (const a of r == null ? void 0 : r.data)
						i[a.rating] += 1;
					return (
						[1, 2, 3, 4, 5].forEach((a) => {
							u[a] = ((i[a] / r.data.length) * 100).toFixed(2);
						}),
						u
					);
				}),
				f = j(!1);
			function m() {
				f.value = !0;
			}
			return (i, u) => (
				n(),
				d(
					y,
					null,
					[
						t(r).data
							? (n(),
							  d("div", _e, [
									e("div", ve, o(i.__("Reviews")), 1),
									e("div", ge, [
										e("div", fe, [
											l.avg_rating
												? (n(),
												  d(
														"div",
														he,
														o(l.avg_rating),
														1
												  ))
												: v("", !0),
											e("div", pe, [
												(n(),
												d(
													y,
													null,
													b(5, (a) =>
														_(
															t($),
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
												o(t(r).data.length) +
													" " +
													o(i.__("reviews")),
												1
											),
											l.membership
												? (n(),
												  p(
														t(x),
														{
															key: 1,
															onClick:
																u[0] ||
																(u[0] = (a) =>
																	m()),
														},
														{
															default: h(() => [
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
											(n(!0),
											d(
												y,
												null,
												b(
													s(5),
													(a) => (
														n(),
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
																			style: G(
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
									e("div", Re, [
										(n(!0),
										d(
											y,
											null,
											b(
												t(r).data,
												(a, w) => (
													n(),
													d("div", null, [
														e("div", Ne, [
															e("div", Ce, [
																_(
																	z,
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
																		Me,
																		[
																			(n(),
																			d(
																				y,
																				null,
																				b(
																					5,
																					(
																						V
																					) =>
																						_(
																							t(
																								$
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
																Le,
																o(a.review),
																1
															),
														]),
														w < t(r).data.length - 1
															? (n(),
															  d("div", Be))
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
								modelValue: f.value,
								"onUpdate:modelValue":
									u[1] || (u[1] = (a) => (f.value = a)),
								reloadReviews: t(r),
								"onUpdate:reloadReviews":
									u[2] ||
									(u[2] = (a) =>
										I(r) ? (r.value = a) : null),
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
	},
	Ue = { key: 0, class: "h-screen text-base" },
	ze = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	Ee = { class: "m-5" },
	qe = { class: "text-3xl font-semibold" },
	De = { class: "my-3" },
	Te = { class: "flex items-center justify-between w-1/3" },
	Oe = { key: 0, class: "flex items-center" },
	Ae = { class: "ml-1" },
	Fe = { key: 1 },
	He = { key: 2, class: "flex items-center" },
	Pe = { class: "ml-1" },
	We = { key: 3 },
	Ge = { class: "flex items-center" },
	Ie = { key: 0 },
	Je = { key: 1 },
	Qe = { key: 2 },
	Ke = { class: "grid grid-cols-[60%,20%] gap-20 mt-10" },
	Xe = { class: "" },
	Ye = ["innerHTML"],
	Ze = { class: "mt-10" },
	et = { class: "text-2xl font-semibold" },
	rt = {
		__name: "CourseDetail",
		props: { courseName: { type: String, required: !0 } },
		setup(l) {
			const c = l,
				s = R({
					url: "lms.lms.utils.get_course_details",
					cache: ["course", c.courseName],
					params: { course: c.courseName },
					auto: !0,
				}),
				r = C(() => {
					var f, m;
					let g = [
						{ label: "All Courses", route: { name: "Courses" } },
					];
					return (
						g.push({
							label:
								(f = s == null ? void 0 : s.data) == null
									? void 0
									: f.title,
							route: {
								name: "CourseDetail",
								params: {
									course:
										(m = s == null ? void 0 : s.data) ==
										null
											? void 0
											: m.name,
								},
							},
						}),
						g
					);
				});
			return (g, f) =>
				t(s).data
					? (n(),
					  d("div", Ue, [
							e("header", ze, [
								_(
									t(J),
									{ class: "h-7", items: r.value },
									null,
									8,
									["items"]
								),
							]),
							e("div", Ee, [
								e("div", null, [
									e("div", qe, o(t(s).data.title), 1),
									e(
										"div",
										De,
										o(t(s).data.short_introduction),
										1
									),
									e("div", Te, [
										t(s).data.avg_rating
											? (n(),
											  d("div", Oe, [
													_(t($), {
														class: "h-5 w-5 text-gray-100 fill-orange-500",
													}),
													e(
														"span",
														Ae,
														o(t(s).data.avg_rating),
														1
													),
											  ]))
											: v("", !0),
										t(s).data.avg_rating
											? (n(), d("span", Fe, "·"))
											: v("", !0),
										t(s).data.enrollment_count
											? (n(),
											  d("div", He, [
													_(t(U), {
														class: "h-4 w-4 text-gray-700",
													}),
													e(
														"span",
														Pe,
														o(
															t(s).data
																.enrollment_count_formatted
														),
														1
													),
											  ]))
											: v("", !0),
										t(s).data.enrollment_count
											? (n(), d("span", We, "·"))
											: v("", !0),
										e("div", Ge, [
											e(
												"span",
												{
													class: k([
														"mr-1",
														{
															"avatar-group overlap":
																t(s).data
																	.instructors
																	.length > 1,
														},
													]),
												},
												[
													(n(!0),
													d(
														y,
														null,
														b(
															t(s).data
																.instructors,
															(m) => (
																n(),
																p(
																	z,
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
											t(s).data.instructors.length == 1
												? (n(),
												  d(
														"span",
														Ie,
														o(
															t(s).data
																.instructors[0]
																.full_name
														),
														1
												  ))
												: v("", !0),
											t(s).data.instructors.length == 2
												? (n(),
												  d(
														"span",
														Je,
														o(
															t(s).data
																.instructors[0]
																.first_name
														) +
															" and " +
															o(
																t(s).data
																	.instructors[1]
																	.first_name
															),
														1
												  ))
												: v("", !0),
											t(s).data.instructors.length > 2
												? (n(),
												  d(
														"span",
														Qe,
														o(
															t(s).data
																.instructors[0]
																.first_name
														) +
															" and " +
															o(
																t(s).data
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
								e("div", Ke, [
									e("div", Xe, [
										e(
											"div",
											{
												innerHTML:
													t(s).data.description,
												class: "course-description",
											},
											null,
											8,
											Ye
										),
										e("div", Ze, [
											e(
												"div",
												et,
												o(g.__("Course Content")),
												1
											),
											_(
												K,
												{ courseName: t(s).data.name },
												null,
												8,
												["courseName"]
											),
										]),
										t(s).data.avg_rating
											? (n(),
											  p(
													je,
													{
														key: 0,
														courseName:
															t(s).data.name,
														avg_rating:
															t(s).data
																.avg_rating,
														membership:
															t(s).data
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
										_(ne, { course: t(s) }, null, 8, [
											"course",
										]),
									]),
								]),
							]),
					  ]))
					: v("", !0);
		},
	};
export { rt as default };
//# sourceMappingURL=CourseDetail-hyS6u7Jr.js.map
