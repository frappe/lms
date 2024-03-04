var A = Object.defineProperty;
var P = Object.getOwnPropertySymbols;
var Y = Object.prototype.hasOwnProperty,
	Z = Object.prototype.propertyIsEnumerable;
var M = (c, u, r) =>
		u in c
			? A(c, u, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: r,
			  })
			: (c[u] = r),
	k = (c, u) => {
		for (var r in u || (u = {})) Y.call(u, r) && M(c, r, u[r]);
		if (P) for (var r of P(u)) Z.call(u, r) && M(c, r, u[r]);
		return c;
	};
import {
	d as ee,
	r as x,
	j as w,
	ad as le,
	k as R,
	s as se,
	y as h,
	H as a,
	J as n,
	K as i,
	F as N,
	G as C,
	M as z,
	L as d,
	Q as oe,
	R as ae,
	ay as te,
	W as ie,
	x as b,
	a6 as re,
	a7 as T,
	az as _,
	aq as ne,
	a4 as B,
	ax as ue,
} from "./frappe-ui-n1bXVQkV.js";
import { e as de, c as ce, d as me } from "./index-xt-hKVBz.js";
import { _ as _e, X as I } from "./Link-xVzNCgtj.js";
import { _ as pe } from "./CourseOutline-mDbSZeRP.js";
import { F as ve } from "./file-text-dAqD9clk.js";
import "./plus-w56hNznP.js";
const be = { class: "h-screen text-base" },
	fe = { class: "grid grid-cols-[70%,30%] h-full" },
	ge = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	ye = { class: "flex items-center" },
	Ce = { class: "mt-5 mb-10" },
	Ve = { class: "container mb-5" },
	he = { class: "text-lg font-semibold mb-4" },
	ke = { class: "mb-4" },
	xe = { class: "mb-1.5 text-sm text-gray-700" },
	we = { class: "mb-4" },
	Ne = { key: 1, class: "mb-4" },
	Te = { class: "text-xs text-gray-600 mb-1" },
	Ue = { class: "flex items-center" },
	$e = { class: "border rounded-md p-2 mr-2" },
	Se = { class: "flex flex-col" },
	je = { class: "text-sm text-gray-500 mt-1" },
	Fe = { class: "mb-1.5 text-sm text-gray-700" },
	Ee = { class: "flex items-center" },
	De = { class: "flex items-center bg-gray-100 p-2 rounded-md mr-2" },
	Le = { class: "container border-t" },
	Pe = { class: "text-lg font-semibold mt-5 mb-4" },
	Me = { class: "flex items-center justify-between mb-5" },
	Re = { class: "container border-t" },
	ze = { class: "text-lg font-semibold mt-5 mb-4" },
	Be = { class: "mb-4" },
	Ie = { class: "border-l px-5 pt-5" },
	We = {
		__name: "CreateCourse",
		props: { courseName: { type: String } },
		setup(c) {
			const u = ee("$user"),
				r = x(""),
				p = x(""),
				m = x(null),
				f = c,
				K = w(() => {
					var e;
					let l = [{ label: "Courses", route: { name: "Courses" } }];
					return (
						t.doc &&
							l.push({
								label: (e = t.doc) == null ? void 0 : e.title,
								route: {
									name: "CourseDetail",
									params: { courseName: f.courseName },
								},
							}),
						l.push({
							label:
								f.courseName == "new"
									? "New Course"
									: "Edit Course",
							route: {
								name: "CreateCourse",
								params: { courseName: f.courseName },
							},
						}),
						l
					);
				}),
				t = le({
					doctype: "LMS Course",
					name: f.courseName,
					auto: !1,
					onSuccess(l) {
						(r.value = l.tags),
							O.reload({ image: l.image }),
							Object.assign(o, l),
							(o.published = !!l.published),
							(o.upcoming = !!l.upcoming),
							(o.disable_self_learning =
								!!l.disable_self_learning),
							(o.paid_course = !!l.paid_course);
					},
				}),
				O = R({
					url: "lms.lms.api.get_file_info",
					makeParams(l) {
						return { file_url: l.image };
					},
					auto: !1,
					onSuccess(l) {
						m.value = l;
					},
				});
			se(() => {
				var l, e;
				(!((l = u.data) != null && l.is_moderator) ||
					!((e = u.data) != null && e.is_instructor)) &&
					(window.location.href = "/login"),
					f.courseName !== "new" && t.reload();
			});
			const o = w(() => {
					var l, e, v, s, g, y, V, S, j, F, E, D, L;
					return {
						title: ((l = t.doc) == null ? void 0 : l.title) || "",
						short_introduction:
							((e = t.doc) == null
								? void 0
								: e.short_introduction) || "",
						description:
							((v = t.doc) == null ? void 0 : v.description) ||
							"",
						video_link:
							((s = t.doc) == null ? void 0 : s.video_link) || "",
						course_image:
							((g = t.doc) == null ? void 0 : g.image) || null,
						tags: ((y = t.doc) == null ? void 0 : y.tags) || "",
						published: !!((V = t.doc) != null && V.published),
						upcoming: !!((S = t.doc) != null && S.upcoming),
						disable_self_learning: !!(
							(j = t.doc) != null && j.disable_self_learning
						),
						course_image: m.value,
						paid_course: !!((F = t.doc) != null && F.paid_course),
						course_price:
							((E = t.doc) == null ? void 0 : E.course_price) ||
							"",
						currency:
							((D = t.doc) == null ? void 0 : D.currency) || "",
						image: ((L = t.doc) == null ? void 0 : L.image) || null,
					};
				}),
				q = w(() => {
					var l, e;
					return (l = t.doc) != null && l.tags
						? t.doc.tags.split(", ")
						: (e = r.value) == null
						? void 0
						: e.split(", ");
				}),
				G = R({
					url: "frappe.client.insert",
					makeParams(l) {
						return {
							doc: k(
								{
									doctype: "LMS Course",
									image: m.value.file_url,
								},
								l
							),
						};
					},
				}),
				H = () => {
					var l;
					t.doc
						? t.setValue.submit(
								k(
									{
										image:
											((l = m.value) == null
												? void 0
												: l.file_url) || null,
									},
									o.value
								),
								{
									validate() {
										return U();
									},
									onError(e) {
										$(e);
									},
								}
						  )
						: G.submit(o.value, {
								validate() {
									return U();
								},
								onError(e) {
									$(e);
								},
						  });
				},
				U = () => {
					const l = [
						"title",
						"short_introduction",
						"description",
						"video_link",
						"course_image",
					];
					for (const e of l)
						if (!o.value[e])
							return `${de(e.split("_").join(" "))} is mandatory`;
					if (
						o.value.paid_course &&
						(!o.value.course_price || !o.value.currency)
					)
						return "Course price and currency are mandatory for paid courses";
				},
				J = (l) => {
					let e = l.name.split(".").pop().toLowerCase();
					if (!["jpg", "jpeg", "png"].includes(e))
						return "Only image file is allowed.";
				},
				Q = () => {
					p.value &&
						((r.value = r.value
							? `${r.value}, ${p.value}`
							: p.value),
						(p.value = ""));
				},
				W = (l) => {
					var e;
					(r.value =
						(e = r.value) == null
							? void 0
							: e
									.split(", ")
									.filter((v) => v !== l)
									.join(", ")),
						(p.value = "");
				},
				$ = (l) => {
					var e;
					ce({
						title: "Error",
						text: ((e = l.messages) == null ? void 0 : e[0]) || l,
						icon: "x",
						iconClasses: "bg-red-600 text-white rounded-md p-px",
						position: "top-center",
						timeout: 10,
					});
				},
				X = () => {
					(m.value = null), (o.value.course_image = null);
				};
			return (l, e) => {
				const v = ie("router-link");
				return (
					b(),
					h("div", be, [
						a("div", fe, [
							a("div", null, [
								a("header", ge, [
									n(
										i(re),
										{ class: "h-7", items: K.value },
										null,
										8,
										["items"]
									),
									a("div", ye, [
										i(t).doc
											? (b(),
											  N(
													v,
													{
														key: 0,
														to: {
															name: "CourseDetail",
															params: {
																courseName:
																	i(t).doc
																		.name,
															},
														},
													},
													{
														default: C(() => [
															n(i(T), null, {
																default: C(
																	() => [
																		a(
																			"span",
																			null,
																			d(
																				l.__(
																					"View Course"
																				)
																			),
																			1
																		),
																	]
																),
																_: 1,
															}),
														]),
														_: 1,
													},
													8,
													["to"]
											  ))
											: z("", !0),
										n(
											i(T),
											{
												variant: "solid",
												onClick:
													e[0] || (e[0] = (s) => H()),
												class: "ml-2",
											},
											{
												default: C(() => [
													a(
														"span",
														null,
														d(l.__("Save")),
														1
													),
												]),
												_: 1,
											}
										),
									]),
								]),
								a("div", Ce, [
									a("div", Ve, [
										a(
											"div",
											he,
											d(l.__("Course Details")),
											1
										),
										n(
											i(_),
											{
												modelValue: o.value.title,
												"onUpdate:modelValue":
													e[1] ||
													(e[1] = (s) =>
														(o.value.title = s)),
												label: l.__("Title"),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										n(
											i(_),
											{
												modelValue:
													o.value.short_introduction,
												"onUpdate:modelValue":
													e[2] ||
													(e[2] = (s) =>
														(o.value.short_introduction =
															s)),
												label: l.__(
													"Short Introduction"
												),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										a("div", ke, [
											a(
												"div",
												xe,
												d(l.__("Course Description")),
												1
											),
											n(
												i(ne),
												{
													content:
														o.value.description,
													onChange:
														e[3] ||
														(e[3] = (s) =>
															(o.value.description =
																s)),
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
										m.value
											? (b(),
											  h("div", Ne, [
													a(
														"div",
														Te,
														d(l.__("Course Image")),
														1
													),
													a("div", Ue, [
														a("div", $e, [
															n(i(ve), {
																class: "h-5 w-5 stroke-1.5 text-gray-700",
															}),
														]),
														a("div", Se, [
															a(
																"span",
																null,
																d(
																	m.value
																		.file_name
																),
																1
															),
															a(
																"span",
																je,
																d(
																	i(me)(
																		m.value
																			.file_size
																	)
																),
																1
															),
														]),
														n(i(I), {
															onClick:
																e[5] ||
																(e[5] = (s) =>
																	X()),
															class: "bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4",
														}),
													]),
											  ]))
											: (b(),
											  N(
													i(ue),
													{
														key: 0,
														fileTypes: ["image/*"],
														validateFile: J,
														onSuccess:
															e[4] ||
															(e[4] = (s) => {
																m.value = s;
															}),
													},
													{
														default: C(
															({
																file: s,
																progress: g,
																uploading: y,
																openFileSelector:
																	V,
															}) => [
																a("div", we, [
																	n(
																		i(T),
																		{
																			onClick:
																				V,
																			loading:
																				y,
																		},
																		{
																			default:
																				C(
																					() => [
																						B(
																							d(
																								y
																									? `Uploading ${g}%`
																									: "Upload an image"
																							),
																							1
																						),
																					]
																				),
																			_: 2,
																		},
																		1032,
																		[
																			"onClick",
																			"loading",
																		]
																	),
																]),
															]
														),
														_: 1,
													}
											  )),
										n(
											i(_),
											{
												modelValue: o.value.video_link,
												"onUpdate:modelValue":
													e[6] ||
													(e[6] = (s) =>
														(o.value.video_link =
															s)),
												label: l.__("Preview Video"),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										a("div", null, [
											a("div", Fe, d(l.__("Tags")), 1),
											a("div", Ee, [
												(b(!0),
												h(
													oe,
													null,
													ae(
														q.value,
														(s) => (
															b(),
															h("div", De, [
																B(
																	d(s) + " ",
																	1
																),
																n(
																	i(I),
																	{
																		class: "stroke-1.5 w-3 h-3 ml-2 cursor-pointer",
																		onClick:
																			(
																				g
																			) =>
																				W(
																					s
																				),
																	},
																	null,
																	8,
																	["onClick"]
																),
															])
														)
													),
													256
												)),
												n(
													i(_),
													{
														modelValue: p.value,
														"onUpdate:modelValue":
															e[7] ||
															(e[7] = (s) =>
																(p.value = s)),
														onKeyup:
															e[8] ||
															(e[8] = te(
																(s) => Q(),
																["enter"]
															)),
													},
													null,
													8,
													["modelValue"]
												),
											]),
										]),
									]),
									a("div", Le, [
										a(
											"div",
											Pe,
											d(l.__("Course Settings")),
											1
										),
										a("div", Me, [
											n(
												i(_),
												{
													type: "checkbox",
													modelValue:
														o.value.published,
													"onUpdate:modelValue":
														e[9] ||
														(e[9] = (s) =>
															(o.value.published =
																s)),
													label: l.__("Published"),
												},
												null,
												8,
												["modelValue", "label"]
											),
											n(
												i(_),
												{
													type: "checkbox",
													modelValue:
														o.value.upcoming,
													"onUpdate:modelValue":
														e[10] ||
														(e[10] = (s) =>
															(o.value.upcoming =
																s)),
													label: l.__("Upcoming"),
												},
												null,
												8,
												["modelValue", "label"]
											),
											n(
												i(_),
												{
													type: "checkbox",
													modelValue:
														o.value
															.disable_self_learning,
													"onUpdate:modelValue":
														e[11] ||
														(e[11] = (s) =>
															(o.value.disable_self_learning =
																s)),
													label: l.__(
														"Disable Self Enrollment"
													),
												},
												null,
												8,
												["modelValue", "label"]
											),
										]),
									]),
									a("div", Re, [
										a(
											"div",
											ze,
											d(l.__("Course Pricing")),
											1
										),
										a("div", Be, [
											n(
												i(_),
												{
													type: "checkbox",
													modelValue:
														o.value.paid_course,
													"onUpdate:modelValue":
														e[12] ||
														(e[12] = (s) =>
															(o.value.paid_course =
																s)),
													label: l.__("Paid Course"),
												},
												null,
												8,
												["modelValue", "label"]
											),
										]),
										n(
											i(_),
											{
												modelValue:
													o.value.course_price,
												"onUpdate:modelValue":
													e[13] ||
													(e[13] = (s) =>
														(o.value.course_price =
															s)),
												label: l.__("Course Price"),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										n(
											_e,
											{
												doctype: "Currency",
												modelValue: o.value.currency,
												"onUpdate:modelValue":
													e[14] ||
													(e[14] = (s) =>
														(o.value.currency = s)),
												filters: { enabled: 1 },
												label: l.__("Currency"),
											},
											null,
											8,
											["modelValue", "label"]
										),
									]),
								]),
							]),
							a("div", Ie, [
								i(t).doc
									? (b(),
									  N(
											pe,
											{
												key: 0,
												courseName: i(t).doc.name,
												title: i(t).doc.title,
												allowEdit: !0,
											},
											null,
											8,
											["courseName", "title"]
									  ))
									: z("", !0),
							]),
						]),
					])
				);
			};
		},
	};
export { We as default };
//# sourceMappingURL=CreateCourse-PkCZOpbW.js.map
