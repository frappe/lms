var O = Object.defineProperty;
var E = Object.getOwnPropertySymbols;
var Q = Object.prototype.hasOwnProperty,
	q = Object.prototype.propertyIsEnumerable;
var L = (c, d, i) =>
		d in c
			? O(c, d, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: i,
			  })
			: (c[d] = i),
	w = (c, d) => {
		for (var i in d || (d = {})) Q.call(d, i) && L(c, i, d[i]);
		if (E) for (var i of E(d)) q.call(d, i) && L(c, i, d[i]);
		return c;
	};
import {
	d as W,
	r as U,
	j as P,
	ad as Y,
	k as M,
	s as Z,
	y as f,
	H as o,
	J as n,
	K as a,
	F as R,
	G as g,
	M as N,
	L as u,
	Q as ee,
	R as le,
	aB as se,
	X as oe,
	x as _,
	a6 as te,
	a7 as x,
	aC as p,
	at as ae,
	U as T,
	aA as re,
} from "./frappe-ui-LT4YqXtx.js";
import { e as ie, c as ne, d as ue } from "./index-6k1S_EjG.js";
import { _ as de, X as B } from "./Link-rwTAUhIL.js";
import { F as ce } from "./file-text-w2g11TfY.js";
import "./plus-0JOmes86.js";
const me = { class: "h-screen text-base" },
	_e = { class: "grid grid-cols-[70%,30%] h-full" },
	pe = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	ve = { class: "flex items-center" },
	be = { class: "mt-5 mb-10" },
	fe = { class: "container mb-5" },
	ge = { class: "text-lg font-semibold mb-4" },
	ye = { class: "mb-4" },
	he = { class: "mb-1.5 text-sm text-gray-700" },
	Ce = { class: "mb-4" },
	Ve = { key: 1, class: "mb-4" },
	ke = { class: "text-xs text-gray-600 mb-1" },
	xe = { class: "flex items-center" },
	we = { class: "border rounded-md p-2 mr-2" },
	Ue = { class: "flex flex-col" },
	Ne = { class: "text-sm text-gray-500 mt-1" },
	Te = { class: "mb-1.5 text-sm text-gray-700" },
	$e = { class: "flex items-center" },
	Se = { class: "flex items-center bg-gray-100 p-2 rounded-md mr-2" },
	Fe = { class: "container border-t" },
	je = { class: "text-lg font-semibold mt-5 mb-4" },
	De = { class: "flex items-center justify-between mb-5" },
	Ee = { class: "container border-t" },
	Le = { class: "text-lg font-semibold mt-5 mb-4" },
	Pe = { class: "mb-4" },
	Me = { class: "bg-gray-50 px-5 pt-5" },
	Re = { key: 0 },
	Be = { class: "text-xl font-semibold" },
	ze = { key: 0 },
	Ie = { key: 1, class: "border bg-white rounded-md p-5 text-center mt-4" },
	Oe = {
		__name: "CreateCourse",
		props: { courseName: { type: String } },
		setup(c) {
			const d = W("$user"),
				i = U(""),
				v = U(""),
				m = U(null),
				y = c,
				z = P(() => {
					var e;
					let l = [{ label: "Courses", route: { name: "Courses" } }];
					return (
						r.doc &&
							l.push({
								label: (e = r.doc) == null ? void 0 : e.title,
								route: {
									name: "CourseDetail",
									params: { courseName: y.courseName },
								},
							}),
						l.push({
							label:
								y.courseName == "new"
									? "New Course"
									: "Edit Course",
							route: {
								name: "CreateCourse",
								params: { courseName: y.courseName },
							},
						}),
						l
					);
				}),
				r = Y({
					doctype: "LMS Course",
					name: y.courseName,
					auto: !1,
					onSuccess(l) {
						I.reload({ image: l.image }), (i.value = l.tags);
					},
				}),
				I = M({
					url: "lms.lms.api.get_file_info",
					makeParams(l) {
						return { file_url: l.image };
					},
					auto: !1,
					onSuccess(l) {
						m.value = l;
					},
				});
			Z(() => {
				var l, e;
				(!((l = d.data) != null && l.is_moderator) ||
					!((e = d.data) != null && e.is_instructor)) &&
					(window.location.href = "/login"),
					y.courseName !== "new" && r.reload();
			});
			const t = P(() => {
					var l, e, b, h, s, C, V, k, F, j, D;
					return {
						title: ((l = r.doc) == null ? void 0 : l.title) || "",
						short_introduction:
							((e = r.doc) == null
								? void 0
								: e.short_introduction) || "",
						description:
							((b = r.doc) == null ? void 0 : b.description) ||
							"",
						video_link:
							((h = r.doc) == null ? void 0 : h.video_link) || "",
						course_image:
							((s = r.doc) == null ? void 0 : s.image) || null,
						tags: i.value,
						published: !!((C = r.doc) != null && C.published),
						upcoming: !!((V = r.doc) != null && V.upcoming),
						disable_self_learning: !!(
							(k = r.doc) != null && k.disable_self_learning
						),
						course_image: m.value,
						paid_course: !!((F = r.doc) != null && F.paid_course),
						course_price:
							((j = r.doc) == null ? void 0 : j.course_price) ||
							"",
						currency:
							((D = r.doc) == null ? void 0 : D.currency) || "",
					};
				}),
				K = M({
					url: "frappe.client.insert",
					makeParams(l) {
						return {
							doc: w(
								{
									doctype: "LMS Course",
									image: m.value.file_url,
								},
								l
							),
						};
					},
				}),
				A = () => {
					var l;
					r.doc
						? r.setValue.submit(
								w(
									{
										image:
											((l = m.value) == null
												? void 0
												: l.file_url) || null,
									},
									t.value
								),
								{
									validate() {
										return $();
									},
									onError(e) {
										S(e);
									},
								}
						  )
						: K.submit(t.value, {
								validate() {
									return $();
								},
								onError(e) {
									S(e);
								},
						  });
				},
				$ = () => {
					const l = [
						"title",
						"short_introduction",
						"description",
						"video_link",
						"course_image",
					];
					for (const e of l)
						if (!t.value[e])
							return `${ie(e.split("_").join(" "))} is mandatory`;
					if (
						t.value.paid_course &&
						(!t.value.course_price || !t.value.currency)
					)
						return "Course price and currency are mandatory for paid courses";
				},
				X = (l) => {
					let e = l.name.split(".").pop().toLowerCase();
					if (!["jpg", "jpeg", "png"].includes(e))
						return "Only image file is allowed.";
				},
				G = () => {
					v.value &&
						((i.value = i.value
							? `${i.value}, ${v.value}`
							: v.value),
						(v.value = ""));
				},
				H = (l) => {
					var e;
					(i.value =
						(e = i.value) == null
							? void 0
							: e
									.split(", ")
									.filter((b) => b !== l)
									.join(", ")),
						(v.value = "");
				},
				S = (l) => {
					var e;
					ne({
						title: "Error",
						text: ((e = l.messages) == null ? void 0 : e[0]) || l,
						icon: "x",
						iconClasses: "bg-red-600 text-white rounded-md p-px",
						position: "top-center",
						timeout: 10,
					});
				},
				J = () => {
					(m.value = null), (t.value.course_image = null);
				};
			return (l, e) => {
				var h;
				const b = oe("router-link");
				return (
					_(),
					f("div", me, [
						o("div", _e, [
							o("div", null, [
								o("header", pe, [
									n(
										a(te),
										{ class: "h-7", items: z.value },
										null,
										8,
										["items"]
									),
									o("div", ve, [
										a(r).doc
											? (_(),
											  R(
													b,
													{
														key: 0,
														to: {
															name: "CourseDetail",
															params: {
																courseName:
																	a(r).doc
																		.name,
															},
														},
													},
													{
														default: g(() => [
															n(a(x), null, {
																default: g(
																	() => [
																		o(
																			"span",
																			null,
																			u(
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
											: N("", !0),
										n(
											a(x),
											{
												variant: "solid",
												onClick:
													e[0] || (e[0] = (s) => A()),
												class: "ml-2",
											},
											{
												default: g(() => [
													o(
														"span",
														null,
														u(l.__("Save")),
														1
													),
												]),
												_: 1,
											}
										),
									]),
								]),
								o("div", be, [
									o("div", fe, [
										o(
											"div",
											ge,
											u(l.__("Course Details")),
											1
										),
										n(
											a(p),
											{
												modelValue: t.value.title,
												"onUpdate:modelValue":
													e[1] ||
													(e[1] = (s) =>
														(t.value.title = s)),
												label: l.__("Title"),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										n(
											a(p),
											{
												modelValue:
													t.value.short_introduction,
												"onUpdate:modelValue":
													e[2] ||
													(e[2] = (s) =>
														(t.value.short_introduction =
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
										o("div", ye, [
											o(
												"div",
												he,
												u(l.__("Course Description")),
												1
											),
											n(
												a(ae),
												{
													content:
														t.value.description,
													onChange:
														e[3] ||
														(e[3] = (s) =>
															(t.value.description =
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
											? (_(),
											  f("div", Ve, [
													o(
														"div",
														ke,
														u(l.__("Course Image")),
														1
													),
													o("div", xe, [
														o("div", we, [
															n(a(ce), {
																class: "h-5 w-5 stroke-1.5 text-gray-700",
															}),
														]),
														o("div", Ue, [
															o(
																"span",
																null,
																u(
																	m.value
																		.file_name
																),
																1
															),
															o(
																"span",
																Ne,
																u(
																	a(ue)(
																		m.value
																			.file_size
																	)
																),
																1
															),
														]),
														n(a(B), {
															onClick:
																e[5] ||
																(e[5] = (s) =>
																	J()),
															class: "bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4",
														}),
													]),
											  ]))
											: (_(),
											  R(
													a(re),
													{
														key: 0,
														fileTypes: ["image/*"],
														validateFile: X,
														onSuccess:
															e[4] ||
															(e[4] = (s) => {
																m.value = s;
															}),
													},
													{
														default: g(
															({
																file: s,
																progress: C,
																uploading: V,
																openFileSelector:
																	k,
															}) => [
																o("div", Ce, [
																	n(
																		a(x),
																		{
																			onClick:
																				k,
																			loading:
																				V,
																		},
																		{
																			default:
																				g(
																					() => [
																						T(
																							u(
																								V
																									? `Uploading ${C}%`
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
											a(p),
											{
												modelValue: t.value.video_link,
												"onUpdate:modelValue":
													e[6] ||
													(e[6] = (s) =>
														(t.value.video_link =
															s)),
												label: l.__("Preview Video"),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										o("div", null, [
											o("div", Te, u(l.__("Tags")), 1),
											o("div", $e, [
												i.value
													? (_(!0),
													  f(
															ee,
															{ key: 0 },
															le(
																(h = i.value) ==
																	null
																	? void 0
																	: h.split(
																			", "
																	  ),
																(s) => (
																	_(),
																	f(
																		"div",
																		Se,
																		[
																			T(
																				u(
																					s
																				) +
																					" ",
																				1
																			),
																			n(
																				a(
																					B
																				),
																				{
																					class: "stroke-1.5 w-3 h-3 ml-2 cursor-pointer",
																					onClick:
																						(
																							C
																						) =>
																							H(
																								s
																							),
																				},
																				null,
																				8,
																				[
																					"onClick",
																				]
																			),
																		]
																	)
																)
															),
															256
													  ))
													: N("", !0),
												n(
													a(p),
													{
														modelValue: v.value,
														"onUpdate:modelValue":
															e[7] ||
															(e[7] = (s) =>
																(v.value = s)),
														onKeyup:
															e[8] ||
															(e[8] = se(
																(s) => G(),
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
									o("div", Fe, [
										o(
											"div",
											je,
											u(l.__("Course Settings")),
											1
										),
										o("div", De, [
											n(
												a(p),
												{
													type: "checkbox",
													modelValue:
														t.value.published,
													"onUpdate:modelValue":
														e[9] ||
														(e[9] = (s) =>
															(t.value.published =
																s)),
													label: l.__("Published"),
												},
												null,
												8,
												["modelValue", "label"]
											),
											n(
												a(p),
												{
													type: "checkbox",
													modelValue:
														t.value.upcoming,
													"onUpdate:modelValue":
														e[10] ||
														(e[10] = (s) =>
															(t.value.upcoming =
																s)),
													label: l.__("Upcoming"),
												},
												null,
												8,
												["modelValue", "label"]
											),
											n(
												a(p),
												{
													type: "checkbox",
													modelValue:
														t.value
															.disable_self_learning,
													"onUpdate:modelValue":
														e[11] ||
														(e[11] = (s) =>
															(t.value.disable_self_learning =
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
									o("div", Ee, [
										o(
											"div",
											Le,
											u(l.__("Course Pricing")),
											1
										),
										o("div", Pe, [
											n(
												a(p),
												{
													type: "checkbox",
													modelValue:
														t.value.paid_course,
													"onUpdate:modelValue":
														e[12] ||
														(e[12] = (s) =>
															(t.value.paid_course =
																s)),
													label: l.__("Paid Course"),
												},
												null,
												8,
												["modelValue", "label"]
											),
										]),
										n(
											a(p),
											{
												modelValue:
													t.value.course_price,
												"onUpdate:modelValue":
													e[13] ||
													(e[13] = (s) =>
														(t.value.course_price =
															s)),
												label: l.__("Course Price"),
												class: "mb-4",
											},
											null,
											8,
											["modelValue", "label"]
										),
										n(
											de,
											{
												doctype: "Currency",
												modelValue: t.value.currency,
												"onUpdate:modelValue":
													e[14] ||
													(e[14] = (s) =>
														(t.value.currency = s)),
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
							o("div", Me, [
								a(r).doc
									? (_(),
									  f("div", Re, [
											o("div", Be, u(t.value.title), 1),
											a(r).doc.chapters.length
												? (_(),
												  f(
														"div",
														ze,
														u(a(r).chapters),
														1
												  ))
												: (_(),
												  f("div", Ie, [
														o(
															"div",
															null,
															u(
																l.__(
																	"There are no chapters in this course. Create and manage chapters from here."
																)
															),
															1
														),
														n(
															a(x),
															{ class: "mt-4" },
															{
																default: g(
																	() => [
																		T(
																			u(
																				l.__(
																					"Add Chapter"
																				)
																			),
																			1
																		),
																	]
																),
																_: 1,
															}
														),
												  ])),
									  ]))
									: N("", !0),
							]),
						]),
					])
				);
			};
		},
	};
export { Oe as default };
//# sourceMappingURL=CreateCourse-0E2-P7Ge.js.map
