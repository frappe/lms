import {
	a as k,
	j as B,
	W as $,
	x as n,
	y as u,
	A as f,
	B as _,
	H as s,
	U as M,
	G as t,
	a8 as N,
	I as o,
	J as e,
	F as l,
	a7 as w,
	k as Y,
	Q as L,
	R as T,
	L as H,
	a6 as S,
} from "./frappe-ui-iPT8hMkb.js";
import { b as O, B as C, f as x } from "./index-qZ7Yta4u.js";
import { C as D, a as j } from "./clock-z0R6Od6V.js";
import { _ as R } from "./CourseCard-1i2yp1tI.js";
import "./UserAvatar-nJqmkBPv.js";
import "./star-xishKgdq.js";
const V = { key: 0, class: "shadow rounded-md p-5", style: { width: "300px" } },
	A = { key: 2, class: "text-lg font-semibold mb-3" },
	E = { class: "flex items-center mb-3" },
	F = { class: "flex items-center mb-3" },
	I = { class: "flex items-center" },
	q = {
		__name: "BatchOverlay",
		props: { batch: { type: Object, default: null } },
		setup(c) {
			const y = k("$dayjs"),
				g = k("$user"),
				p = c,
				d = B(() => {
					var a, v, b, r;
					return (a = p.batch.data) != null && a.seat_count
						? ((v = p.batch.data) == null ? void 0 : v.seat_count) -
								((r =
									(b = p.batch.data) == null
										? void 0
										: b.students) == null
									? void 0
									: r.length)
						: null;
				});
			return (a, v) => {
				var r, i, m, h;
				const b = $("router-link");
				return c.batch.data
					? (n(),
					  u("div", V, [
							c.batch.data.seat_count && d.value > 0
								? (n(),
								  f(
										t(N),
										{
											key: 0,
											theme: "green",
											class: "self-start mb-2 float-right",
										},
										{
											default: _(() => [
												M(
													s(d.value) +
														" " +
														s(a.__("Seat Left")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: c.batch.data.seat_count && d.value <= 0
								? (n(),
								  f(
										t(N),
										{
											key: 1,
											theme: "red",
											class: "self-start mb-2 float-right",
										},
										{
											default: _(() => [
												M(s(a.__("Sold Out")), 1),
											]),
											_: 1,
										}
								  ))
								: o("", !0),
							c.batch.data.amount
								? (n(),
								  u(
										"div",
										A,
										s(
											t(O)(
												c.batch.data.amount,
												c.batch.data.currency
											)
										),
										1
								  ))
								: o("", !0),
							e("div", E, [
								l(t(C), {
									class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
								}),
								e(
									"span",
									null,
									s(c.batch.data.courses.length) +
										" " +
										s(a.__("Courses")),
									1
								),
							]),
							e("div", F, [
								l(t(D), {
									class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
								}),
								e(
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
							e("div", I, [
								l(t(j), {
									class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
								}),
								e(
									"span",
									null,
									s(t(x)(c.batch.data.start_time)) +
										" - " +
										s(t(x)(c.batch.data.end_time)),
									1
								),
							]),
							(i = (r = t(g)) == null ? void 0 : r.data) !=
								null && i.is_moderator
								? (n(),
								  f(
										b,
										{
											key: 3,
											to: {
												name: "Batch",
												params: {
													batchName:
														c.batch.data.name,
												},
											},
										},
										{
											default: _(() => [
												l(
													t(w),
													{
														variant: "solid",
														class: "w-full mt-4",
													},
													{
														default: _(() => [
															e(
																"span",
																null,
																s(
																	a.__(
																		"Manage Batch"
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
								: c.batch.data.paid_batch
								? (n(),
								  f(
										t(w),
										{
											key: 4,
											class: "w-full mt-4",
											variant: "solid",
										},
										{
											default: _(() => [
												e(
													"span",
													null,
													s(a.__("Register Now")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: o("", !0),
							(h = (m = t(g)) == null ? void 0 : m.data) !=
								null && h.is_moderator
								? (n(),
								  f(
										t(w),
										{ key: 5, class: "w-full mt-2" },
										{
											default: _(() => [
												e(
													"span",
													null,
													s(a.__("Edit")),
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
	},
	z = { key: 0, class: "h-screen text-base" },
	G = { class: "sticky top-0 z-10 border-b bg-white px-3 py-2.5 sm:px-5" },
	J = { class: "m-5 pb-10" },
	Q = { class: "text-3xl font-semibold" },
	U = { class: "my-3" },
	W = { class: "flex items-center justify-between w-1/2" },
	K = { class: "flex items-center" },
	P = { key: 0 },
	X = { class: "flex items-center" },
	Z = { key: 1 },
	tt = { class: "flex items-center" },
	at = { class: "grid grid-cols-[60%,20%] gap-20 mt-10" },
	et = { class: "" },
	st = ["innerHTML"],
	ct = { class: "text-2xl font-semibold" },
	nt = { class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-5" },
	rt = { key: 0 },
	lt = ["innerHTML"],
	_t = {
		__name: "BatchDetail",
		props: { batchName: { type: String, required: !0 } },
		setup(c) {
			const y = k("$dayjs"),
				g = k("$user"),
				p = H(),
				d = c,
				a = Y({
					url: "lms.lms.utils.get_batch_details",
					cache: ["batch", d.batchName],
					params: { batch: d.batchName },
					auto: !0,
					onSuccess(r) {
						var i;
						(i = r.students) != null &&
							i.includes(g.data.name) &&
							p.push({
								name: "Batch",
								params: { batchName: d.batchName },
							});
					},
				}),
				v = Y({
					url: "lms.lms.utils.get_batch_courses",
					params: { batch: d.batchName },
					cache: ["batchCourses", d.batchName],
					auto: !0,
				}),
				b = B(() => {
					var i, m;
					let r = [
						{ label: "All Batches", route: { name: "Batches" } },
					];
					return (
						r.push({
							label:
								(i = a == null ? void 0 : a.data) == null
									? void 0
									: i.title,
							route: {
								name: "BatchDetail",
								params: {
									batchName:
										(m = a == null ? void 0 : a.data) ==
										null
											? void 0
											: m.name,
								},
							},
						}),
						r
					);
				});
			return (r, i) => {
				const m = $("router-link");
				return t(a).data
					? (n(),
					  u("div", z, [
							e("header", G, [
								l(t(S), { items: b.value }, null, 8, ["items"]),
							]),
							e("div", J, [
								e("div", null, [
									e("div", Q, s(t(a).data.title), 1),
									e("div", U, s(t(a).data.description), 1),
									e("div", W, [
										e("div", K, [
											l(t(C), {
												class: "h-4 w-4 text-gray-700 mr-2",
											}),
											e(
												"span",
												null,
												s(t(a).data.courses.length) +
													" " +
													s(r.__("Courses")),
												1
											),
										]),
										t(a).data.courses
											? (n(), u("span", P, "·"))
											: o("", !0),
										e("div", X, [
											l(t(D), {
												class: "h-4 w-4 text-gray-700 mr-2",
											}),
											e(
												"span",
												null,
												s(
													t(y)(
														t(a).data.start_date
													).format("DD MMM YYYY")
												) +
													" - " +
													s(
														t(y)(
															t(a).data.end_date
														).format("DD MMM YYYY")
													),
												1
											),
										]),
										t(a).data.start_date
											? (n(), u("span", Z, "·"))
											: o("", !0),
										e("div", tt, [
											l(t(j), {
												class: "h-4 w-4 text-gray-700 mr-2",
											}),
											e(
												"span",
												null,
												s(t(x)(t(a).data.start_time)) +
													" - " +
													s(t(x)(t(a).data.end_time)),
												1
											),
										]),
									]),
								]),
								e("div", at, [
									e("div", et, [
										e(
											"div",
											{
												innerHTML:
													t(a).data.batch_details,
												class: "batch-description",
											},
											null,
											8,
											st
										),
									]),
									e("div", null, [
										l(q, { batch: t(a) }, null, 8, [
											"batch",
										]),
									]),
								]),
								e("div", null, [
									e("div", ct, s(r.__("Courses")), 1),
									e("div", nt, [
										t(a).data.courses
											? (n(!0),
											  u(
													L,
													{ key: 0 },
													T(
														t(v).data,
														(h) => (
															n(),
															u(
																"div",
																{
																	key: h.course,
																},
																[
																	l(
																		m,
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
																				_(
																					() => [
																						(n(),
																						f(
																							R,
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
									t(a).data.batch_details_raw
										? (n(),
										  u("div", rt, [
												e(
													"div",
													{
														innerHTML:
															t(a).data
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
//# sourceMappingURL=BatchDetail-MDvOC8VN.js.map
