import {
	a as k,
	j as D,
	s as l,
	u as m,
	y as b,
	z as f,
	X as w,
	E as s,
	D as t,
	a0 as M,
	F as o,
	A as a,
	C as u,
	$ as g,
	k as Y,
	P as N,
	K as j,
	L,
	Z as T,
} from "./frappe-ui.f2211ca2.js";
import { a as H, f as p } from "./index.05189aed.js";
import { B as $ } from "./index.43e529db.js";
import { C as B, a as C } from "./clock.4d13ba48.js";
import { _ as O } from "./CourseCard.6a41330a.js";
import "./UserAvatar.b64a03ac.js";
import "./star.d3e8ecca.js";
const S = { key: 0, class: "shadow rounded-md p-5", style: { width: "300px" } },
	V = { key: 2, class: "text-lg font-semibold mb-3" },
	E = { class: "flex items-center mb-3" },
	z = { class: "flex items-center mb-3" },
	A = { class: "flex items-center" },
	F = {
		__name: "BatchOverlay",
		props: { batch: { type: Object, default: null } },
		setup(c) {
			const y = k("$dayjs"),
				_ = k("$user"),
				e = c,
				v = D(() => {
					var r, d, i, n;
					return (r = e.batch.data) != null && r.seat_count
						? ((d = e.batch.data) == null ? void 0 : d.seat_count) -
								((n =
									(i = e.batch.data) == null
										? void 0
										: i.students) == null
									? void 0
									: n.length)
						: null;
				});
			return (r, d) => {
				var i, n, h, x;
				return c.batch.data
					? (l(),
					  m("div", S, [
							c.batch.data.seat_count && v.value > 0
								? (l(),
								  b(
										t(M),
										{
											key: 0,
											theme: "green",
											class: "self-start mb-2 float-right",
										},
										{
											default: f(() => [
												w(
													s(v.value) +
														" " +
														s(r.__("Seat Left")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: c.batch.data.seat_count && v.value <= 0
								? (l(),
								  b(
										t(M),
										{
											key: 1,
											theme: "red",
											class: "self-start mb-2 float-right",
										},
										{
											default: f(() => [
												w(s(r.__("Sold Out")), 1),
											]),
											_: 1,
										}
								  ))
								: o("", !0),
							c.batch.data.amount
								? (l(),
								  m(
										"div",
										V,
										s(
											t(H)(
												c.batch.data.amount,
												c.batch.data.currency
											)
										),
										1
								  ))
								: o("", !0),
							a("div", E, [
								u(t($), {
									class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
								}),
								a(
									"span",
									null,
									s(c.batch.data.courses.length) +
										" " +
										s(r.__("Courses")),
									1
								),
							]),
							a("div", z, [
								u(t(B), {
									class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
								}),
								a(
									"span",
									null,
									s(
										t(y)(c.batch.data.start_date).format(
											"DD MMM YYYY"
										)
									) +
										" - " +
										s(
											t(y)(c.batch.data.end_date).format(
												"DD MMM YYYY"
											)
										),
									1
								),
							]),
							a("div", A, [
								u(t(C), {
									class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
								}),
								a(
									"span",
									null,
									s(t(p)(c.batch.data.start_time)) +
										" - " +
										s(t(p)(c.batch.data.end_time)),
									1
								),
							]),
							(n = (i = t(_)) == null ? void 0 : i.data) !=
								null && n.is_moderator
								? (l(),
								  b(
										t(g),
										{ key: 3, class: "w-full mt-4" },
										{
											default: f(() => [
												a(
													"span",
													null,
													s(r.__("Manage Batch")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: c.batch.data.paid_batch
								? (l(),
								  b(
										t(g),
										{
											key: 4,
											class: "w-full mt-4",
											variant: "solid",
										},
										{
											default: f(() => [
												a(
													"span",
													null,
													s(r.__("Register Now")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: o("", !0),
							(x = (h = t(_)) == null ? void 0 : h.data) !=
								null && x.is_moderator
								? (l(),
								  b(
										t(g),
										{ key: 5, class: "w-full mt-2" },
										{
											default: f(() => [
												a(
													"span",
													null,
													s(r.__("Edit")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: o("", !0),
					  ]))
					: o("", !0);
			};
		},
	};
const R = { key: 0, class: "h-screen text-base" },
	q = { class: "sticky top-0 z-10 border-b bg-white px-3 py-2.5 sm:px-5" },
	I = { class: "m-5 pb-10" },
	K = { class: "text-3xl font-semibold" },
	P = { class: "my-3" },
	X = { class: "flex items-center justify-between w-1/2" },
	Z = { class: "flex items-center" },
	G = { key: 0 },
	J = { class: "flex items-center" },
	Q = { key: 1 },
	U = { class: "flex items-center" },
	W = { class: "grid grid-cols-[60%,20%] gap-20 mt-10" },
	tt = { class: "" },
	at = ["innerHTML"],
	et = { class: "text-2xl font-semibold" },
	st = { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-5" },
	ct = { key: 0 },
	lt = ["innerHTML"],
	_t = {
		__name: "BatchDetail",
		props: { batchName: { type: String, required: !0 } },
		setup(c) {
			const y = k("$dayjs"),
				_ = c,
				e = Y({
					url: "lms.lms.utils.get_batch_details",
					cache: ["batch", _.batchName],
					params: { batch: _.batchName },
					auto: !0,
				}),
				v = Y({
					url: "lms.lms.utils.get_batch_courses",
					params: { batch: _.batchName },
					cache: ["batchCourses", _.batchName],
					auto: !0,
				}),
				r = D(() => {
					var i, n;
					let d = [
						{ label: "All Batches", route: { name: "Batches" } },
					];
					return (
						d.push({
							label:
								(i = e == null ? void 0 : e.data) == null
									? void 0
									: i.title,
							route: {
								name: "BatchDetail",
								params: {
									batchName:
										(n = e == null ? void 0 : e.data) ==
										null
											? void 0
											: n.name,
								},
							},
						}),
						d
					);
				});
			return (d, i) => {
				const n = N("router-link");
				return t(e).data
					? (l(),
					  m("div", R, [
							a("header", q, [
								u(t(T), { items: r.value }, null, 8, ["items"]),
							]),
							a("div", I, [
								a("div", null, [
									a("div", K, s(t(e).data.title), 1),
									a("div", P, s(t(e).data.description), 1),
									a("div", X, [
										a("div", Z, [
											u(t($), {
												class: "h-4 w-4 text-gray-700 mr-2",
											}),
											a(
												"span",
												null,
												s(t(e).data.courses.length) +
													" " +
													s(d.__("Courses")),
												1
											),
										]),
										t(e).data.courses
											? (l(), m("span", G, "\xB7"))
											: o("", !0),
										a("div", J, [
											u(t(B), {
												class: "h-4 w-4 text-gray-700 mr-2",
											}),
											a(
												"span",
												null,
												s(
													t(y)(
														t(e).data.start_date
													).format("DD MMM YYYY")
												) +
													" - " +
													s(
														t(y)(
															t(e).data.end_date
														).format("DD MMM YYYY")
													),
												1
											),
										]),
										t(e).data.start_date
											? (l(), m("span", Q, "\xB7"))
											: o("", !0),
										a("div", U, [
											u(t(C), {
												class: "h-4 w-4 text-gray-700 mr-2",
											}),
											a(
												"span",
												null,
												s(t(p)(t(e).data.start_time)) +
													" - " +
													s(t(p)(t(e).data.end_time)),
												1
											),
										]),
									]),
								]),
								a("div", W, [
									a("div", tt, [
										a(
											"div",
											{
												innerHTML:
													t(e).data.batch_details,
												class: "batch-description",
											},
											null,
											8,
											at
										),
									]),
									a("div", null, [
										u(F, { batch: t(e) }, null, 8, [
											"batch",
										]),
									]),
								]),
								a("div", null, [
									a("div", et, s(d.__("Courses")), 1),
									a("div", st, [
										t(e).data.courses
											? (l(!0),
											  m(
													j,
													{ key: 0 },
													L(
														t(v).data,
														(h) => (
															l(),
															m(
																"div",
																{
																	key: h.course,
																},
																[
																	u(
																		n,
																		{
																			to: {
																				name: "CourseDetail",
																				params: {
																					courseName:
																						h.name,
																				},
																			},
																		},
																		{
																			default:
																				f(
																					() => [
																						(l(),
																						b(
																							O,
																							{
																								course: h,
																								key: h.name,
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
																		["to"]
																	),
																]
															)
														)
													),
													128
											  ))
											: o("", !0),
									]),
									t(e).data.batch_details_raw
										? (l(),
										  m("div", ct, [
												a(
													"div",
													{
														innerHTML:
															t(e).data
																.batch_details_raw,
														class: "batch-description",
													},
													null,
													8,
													lt
												),
										  ]))
										: o("", !0),
								]),
							]),
					  ]))
					: o("", !0);
			};
		},
	};
export { _t as default };
