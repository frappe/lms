import {
	a as k,
	s as o,
	u as n,
	A as e,
	E as a,
	K as j,
	L as A,
	C as r,
	D as s,
	af as T,
	k as M,
	j as g,
	r as E,
	P as I,
	z as h,
	B as Y,
	y as x,
	J as P,
	F as y,
	X as f,
	Z as F,
	a0 as H,
	a1 as O,
	$ as S,
} from "./frappe-ui.f2211ca2.js";
import { f as $ } from "./index.05189aed.js";
import { _ as q } from "./CourseCard.6a41330a.js";
import { C as L, a as V } from "./clock.4d13ba48.js";
import { c as U, B as J } from "./index.43e529db.js";
import "./UserAvatar.b64a03ac.js";
import "./star.d3e8ecca.js";
const K = U("LayoutDashboardIcon", [
		[
			"rect",
			{ width: "7", height: "9", x: "3", y: "3", rx: "1", key: "10lvy0" },
		],
		[
			"rect",
			{
				width: "7",
				height: "5",
				x: "14",
				y: "3",
				rx: "1",
				key: "16une8",
			},
		],
		[
			"rect",
			{
				width: "7",
				height: "9",
				x: "14",
				y: "12",
				rx: "1",
				key: "1hutg5",
			},
		],
		[
			"rect",
			{
				width: "7",
				height: "5",
				x: "3",
				y: "16",
				rx: "1",
				key: "ldoo1y",
			},
		],
	]),
	R = U("UserCog2Icon", [
		["path", { d: "M14 19a6 6 0 0 0-12 0", key: "vej9p1" }],
		["circle", { cx: "8", cy: "9", r: "4", key: "143rtg" }],
		["circle", { cx: "19", cy: "11", r: "2", key: "1rxg02" }],
		["path", { d: "M19 8v1", key: "1iffrw" }],
		["path", { d: "M19 13v1", key: "z4xc62" }],
		["path", { d: "m21.6 9.5-.87.5", key: "6lxupl" }],
		["path", { d: "m17.27 12-.87.5", key: "1rwhxx" }],
		["path", { d: "m21.6 12.5-.87-.5", key: "agvc9a" }],
		["path", { d: "m17.27 10-.87-.5", key: "12d57s" }],
	]),
	X = { class: "mb-10" },
	Z = { class: "text-lg font-semibold mb-4" },
	G = { key: 0 },
	Q = { class: "grid grid-cols-2" },
	W = { class: "border rounded-md p-3" },
	ee = { class: "font-medium mb-3" },
	se = { class: "flex items-center mb-2" },
	te = { class: "ml-2" },
	ae = { class: "flex items-center mb-2" },
	oe = { class: "ml-2" },
	ne = { class: "flex items-center" },
	ce = { class: "ml-2" },
	re = { key: 1, class: "text-sm italic text-gray-600" },
	le = {
		__name: "UpcomingEvaluations",
		props: { upcoming_evals: { type: Array, default: [] } },
		setup(_) {
			const l = k("$dayjs");
			return (i, d) => (
				o(),
				n("div", X, [
					e("div", Z, a(i.__("Upcoming Evaluations")), 1),
					_.upcoming_evals.length
						? (o(),
						  n("div", G, [
								e("div", Q, [
									(o(!0),
									n(
										j,
										null,
										A(
											_.upcoming_evals,
											(t) => (
												o(),
												n("div", null, [
													e("div", W, [
														e(
															"div",
															ee,
															a(t.course_title),
															1
														),
														e("div", se, [
															r(s(L), {
																class: "w-4 h-4 stroke-1.5",
															}),
															e(
																"span",
																te,
																a(
																	s(l)(
																		t.date
																	).format(
																		"DD MMMM YYYY"
																	)
																),
																1
															),
														]),
														e("div", ae, [
															r(s(V), {
																class: "w-4 h-4 stroke-1.5",
															}),
															e(
																"span",
																oe,
																a(
																	s($)(
																		t.start_time
																	)
																),
																1
															),
														]),
														e("div", ne, [
															r(s(R), {
																class: "w-4 h-4 stroke-1.5",
															}),
															e(
																"span",
																ce,
																a(
																	t.evaluator_name
																),
																1
															),
														]),
													]),
												])
											)
										),
										256
									)),
								]),
						  ]))
						: (o(),
						  n("div", re, a(i.__("No upcoming evaluations.")), 1)),
				])
			);
		},
	},
	ie = { class: "text-lg font-semibold mb-4" },
	de = { key: 0 },
	me = { key: 1, class: "text-sm italic text-gray-600" },
	_e = {
		__name: "Assessments",
		props: { assessments: { type: Array, default: [] } },
		setup(_) {
			return (l, i) => {
				var d, t;
				return (
					o(),
					n("div", null, [
						e("div", ie, a(l.__("Assessments")), 1),
						(d = _.assessments) != null && d.length
							? (o(),
							  n("div", de, [
									r(
										s(T),
										{
											columns: l.getAssessmentColumns(),
											rows:
												(t = l.attempts) == null
													? void 0
													: t.data,
											"row-key": "name",
											options: {
												selectable: !1,
												showTooltip: !1,
											},
										},
										null,
										8,
										["columns", "rows"]
									),
							  ]))
							: (o(), n("div", me, a(l.__("No Assessments")), 1)),
					])
				);
			};
		},
	},
	ue = {
		__name: "BatchDashboard",
		props: { batch: { type: Object, default: null } },
		setup(_) {
			return (l, i) => (
				o(),
				n("div", null, [
					r(
						le,
						{ upcoming_evals: _.batch.data.upcoming_evals },
						null,
						8,
						["upcoming_evals"]
					),
					r(_e, { assessments: _.batch.data.assessments }, null, 8, [
						"assessments",
					]),
				])
			);
		},
	},
	he = { key: 0, class: "h-screen text-base" },
	pe = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	be = { key: 0 },
	ye = { class: "grid grid-cols-[70%,30%] h-full" },
	fe = { class: "border-r-2" },
	ve = { class: "p-10" },
	ge = { key: 0 },
	xe = { class: "text-xl font-semibold" },
	ke = { class: "grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-8 mt-5" },
	$e = { key: 1 },
	we = { class: "p-5" },
	Ne = { class: "text-2xl font-semibold mb-3" },
	Ce = { class: "flex items-center mb-3" },
	De = { class: "flex items-center mb-6" },
	Be = ["innerHTML"],
	Me = { key: 1, class: "h-screen" },
	Ye = { class: "text-base border rounded-md w-1/3 mx-auto my-32" },
	je = { class: "border-b px-5 py-3 font-medium" },
	Ae = e(
		"span",
		{
			class: "inline-flex items-center before:bg-red-600 before:w-2 before:h-2 before:rounded-md before:mr-2",
		},
		null,
		-1
	),
	Le = { class: "px-5 py-3" },
	Ve = { class: "mb-4 leading-6" },
	He = {
		__name: "Batch",
		props: { batchName: { type: String, required: !0 } },
		setup(_) {
			const l = k("$dayjs"),
				i = k("$user"),
				d = _,
				t = M({
					url: "lms.lms.utils.get_batch_details",
					cache: ["batch", d.batchName],
					params: { batch: d.batchName },
					auto: !0,
				}),
				z = g(() => {
					var c;
					return [
						{ label: "All Batches", route: { name: "Batches" } },
						{
							label: "Batch Details",
							route: {
								name: "BatchDetail",
								params: { batchName: d.batchName },
							},
						},
						{
							label:
								(c = t == null ? void 0 : t.data) == null
									? void 0
									: c.title,
							route: {
								name: "Batch",
								params: { batchName: d.batchName },
							},
						},
					];
				}),
				w = g(() => {
					var c, p;
					return (
						(i == null ? void 0 : i.data) &&
						((c = t.data) == null ? void 0 : c.students.length) &&
						((p = t.data) == null
							? void 0
							: p.students.includes(i.data.name))
					);
				}),
				N = E(0),
				v = [];
			w && v.push({ label: "Dashboard", icon: K }),
				v.push({
					label: "Courses",
					count: g(() => {
						var c;
						return (c = b == null ? void 0 : b.data) == null
							? void 0
							: c.length;
					}),
					icon: J,
				});
			const b = M({
				url: "lms.lms.utils.get_batch_courses",
				params: { batch: d.batchName },
				cache: ["batchCourses", d.batchName],
				auto: !0,
			});
			return (c, p) => {
				var D, B;
				const C = I("router-link");
				return ((D = s(i).data) == null ? void 0 : D.is_moderator) ||
					w.value
					? (o(),
					  n("div", he, [
							e("header", pe, [
								r(
									s(F),
									{ class: "h-7", items: z.value },
									null,
									8,
									["items"]
								),
							]),
							s(t).data
								? (o(),
								  n("div", be, [
										e("div", ye, [
											e("div", fe, [
												r(
													s(O),
													{
														class: "overflow-hidden",
														modelValue: N.value,
														"onUpdate:modelValue":
															p[0] ||
															(p[0] = (m) =>
																(N.value = m)),
														tabs: v,
													},
													{
														tab: h(
															({
																tab: m,
																selected: u,
															}) => [
																e("div", null, [
																	e(
																		"button",
																		{
																			class: Y(
																				[
																					"group -mb-px flex items-center gap-1 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
																					{
																						"text-gray-900":
																							u,
																					},
																				]
																			),
																		},
																		[
																			m.icon
																				? (o(),
																				  x(
																						P(
																							m.icon
																						),
																						{
																							key: 0,
																							class: "h-4 stroke-1.5",
																						}
																				  ))
																				: y(
																						"",
																						!0
																				  ),
																			f(
																				" " +
																					a(
																						c.__(
																							m.label
																						)
																					) +
																					" ",
																				1
																			),
																			m.count
																				? (o(),
																				  x(
																						s(
																							H
																						),
																						{
																							key: 1,
																							class: Y(
																								{
																									"text-gray-900 border border-gray-900":
																										u,
																								}
																							),
																							variant:
																								"subtle",
																							theme: "gray",
																							size: "sm",
																						},
																						{
																							default:
																								h(
																									() => [
																										f(
																											a(
																												m.count
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
																				  ))
																				: y(
																						"",
																						!0
																				  ),
																		],
																		2
																	),
																]),
															]
														),
														default: h(
															({ tab: m }) => [
																e("div", ve, [
																	m.label ==
																	"Courses"
																		? (o(),
																		  n(
																				"div",
																				ge,
																				[
																					e(
																						"div",
																						xe,
																						a(
																							c.__(
																								"Courses"
																							)
																						),
																						1
																					),
																					e(
																						"div",
																						ke,
																						[
																							(o(
																								!0
																							),
																							n(
																								j,
																								null,
																								A(
																									s(
																										b
																									)
																										.data,
																									(
																										u
																									) => (
																										o(),
																										n(
																											"div",
																											null,
																											[
																												r(
																													C,
																													{
																														to: {
																															name: "CourseDetail",
																															params: {
																																courseName:
																																	u.name,
																															},
																														},
																													},
																													{
																														default:
																															h(
																																() => [
																																	(o(),
																																	x(
																																		q,
																																		{
																																			key: u.name,
																																			course: u,
																																		},
																																		null,
																																		8,
																																		[
																																			"course",
																																		]
																																	)),
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
																										)
																									)
																								),
																								256
																							)),
																						]
																					),
																				]
																		  ))
																		: m.label ==
																		  "Dashboard"
																		? (o(),
																		  n(
																				"div",
																				$e,
																				[
																					r(
																						ue,
																						{
																							batch: s(
																								t
																							),
																						},
																						null,
																						8,
																						[
																							"batch",
																						]
																					),
																				]
																		  ))
																		: y(
																				"",
																				!0
																		  ),
																]),
															]
														),
														_: 1,
													},
													8,
													["modelValue"]
												),
											]),
											e("div", we, [
												e(
													"div",
													Ne,
													a(s(t).data.title),
													1
												),
												e("div", Ce, [
													r(s(L), {
														class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
													}),
													e(
														"span",
														null,
														a(
															s(l)(
																s(t).data
																	.start_date
															).format(
																"DD MMM YYYY"
															)
														) +
															" - " +
															a(
																s(l)(
																	s(t).data
																		.end_date
																).format(
																	"DD MMM YYYY"
																)
															),
														1
													),
												]),
												e("div", De, [
													r(s(V), {
														class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
													}),
													e(
														"span",
														null,
														a(
															s($)(
																s(t).data
																	.start_time
															)
														) +
															" - " +
															a(
																s($)(
																	s(t).data
																		.end_time
																)
															),
														1
													),
												]),
												e(
													"div",
													{
														innerHTML:
															s(t).data
																.description,
													},
													null,
													8,
													Be
												),
											]),
										]),
								  ]))
								: y("", !0),
					  ]))
					: (o(),
					  n("div", Me, [
							e("div", Ye, [
								e("div", je, [
									Ae,
									f(" " + a(c.__("Not Permitted")), 1),
								]),
								e("div", Le, [
									e(
										"div",
										Ve,
										a(
											c.__(
												"You are not a member of this batch. Please checkout our upcoming batches."
											)
										),
										1
									),
									r(
										C,
										{
											to: {
												name: "Batches",
												params: {
													batchName:
														(B = s(t).data) == null
															? void 0
															: B.name,
												},
											},
										},
										{
											default: h(() => [
												r(
													s(S),
													{
														variant: "solid",
														class: "w-full",
													},
													{
														default: h(() => [
															f(
																a(
																	c.__(
																		"Upcoming Batches"
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
									),
								]),
							]),
					  ]));
			};
		},
	};
export { He as default };
