import {
	a as C,
	s as n,
	u,
	y as g,
	z as h,
	X as _,
	E as t,
	D as c,
	a0 as y,
	F as x,
	A as a,
	C as i,
	k as D,
	r as Y,
	j as m,
	P as j,
	B as $,
	J as N,
	K as V,
	L as M,
	Z as z,
	$ as L,
	a1 as P,
} from "./frappe-ui.a747cf9c.js";
import { f as B } from "./index.6f049c1a.js";
import { B as A } from "./index.51e5b051.js";
import { C as E, a as O } from "./clock.b36d19aa.js";
import { P as S } from "./plus.d245902e.js";
const F = {
		class: "flex flex-col border border-gray-200 rounded-md p-4 h-full",
		style: { "min-height": "150px" },
	},
	T = { class: "text-xl font-semibold mb-1" },
	U = { class: "short-introduction" },
	I = { class: "mt-auto" },
	J = { key: 0, class: "font-semibold text-lg mb-4" },
	K = { class: "flex items-center mb-3" },
	R = { class: "flex items-center mb-3" },
	X = { class: "flex items-center" },
	Z = {
		__name: "BatchCard",
		props: { batch: { type: Object, default: null } },
		setup(s) {
			const d = C("$dayjs");
			return (o, v) => (
				n(),
				u("div", F, [
					s.batch.seat_count && s.batch.seats_left > 0
						? (n(),
						  g(
								c(y),
								{
									key: 0,
									theme: "green",
									class: "self-start mb-2",
								},
								{
									default: h(() => [
										_(
											t(s.batch.seats_left) +
												" " +
												t(o.__("Seat Left")),
											1
										),
									]),
									_: 1,
								}
						  ))
						: s.batch.seat_count && s.batch.seats_left <= 0
						? (n(),
						  g(
								c(y),
								{
									key: 1,
									theme: "red",
									class: "self-start mb-2",
								},
								{
									default: h(() => [
										_(t(o.__("Sold Out")), 1),
									]),
									_: 1,
								}
						  ))
						: x("", !0),
					a("div", T, t(s.batch.title), 1),
					a("div", U, t(s.batch.description), 1),
					a("div", I, [
						s.batch.amount
							? (n(), u("div", J, t(s.batch.price), 1))
							: x("", !0),
						a("div", K, [
							i(c(A), {
								class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
							}),
							a(
								"span",
								null,
								t(s.batch.courses.length) +
									" " +
									t(o.__("Courses")),
								1
							),
						]),
						a("div", R, [
							i(c(E), {
								class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
							}),
							a(
								"span",
								null,
								t(
									c(d)(s.batch.start_date).format(
										"DD MMM YYYY"
									)
								) +
									" - " +
									t(
										c(d)(s.batch.end_date).format(
											"DD MMM YYYY"
										)
									),
								1
							),
						]),
						a("div", X, [
							i(c(O), {
								class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
							}),
							a(
								"span",
								null,
								t(c(B)(s.batch.start_time)) +
									" - " +
									t(c(B)(s.batch.end_time)),
								1
							),
						]),
					]),
				])
			);
		},
	},
	q = { class: "h-screen text-base" },
	G = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	H = { class: "flex" },
	Q = { class: "mx-5 py-5" },
	W = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-8 mt-5",
	},
	ee = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	te = { class: "flex flex-col items-center justify-center mt-4" },
	re = {
		__name: "Batches",
		setup(s) {
			var p, k;
			const d = C("$user"),
				o = D({
					url: "lms.lms.utils.get_batches",
					cache: [
						"batches",
						(p = d == null ? void 0 : d.data) == null
							? void 0
							: p.email,
					],
					auto: !0,
				}),
				v = Y(0),
				f = [
					{
						label: "Upcoming",
						batches: m(() => {
							var e;
							return (
								((e = o.data) == null ? void 0 : e.upcoming) ||
								[]
							);
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = o.data) == null ? void 0 : e.upcoming) ==
								null
								? void 0
								: l.length;
						}),
					},
				];
			return (
				(k = d.data) != null &&
					k.is_moderator &&
					(f.push({
						label: "Archived",
						batches: m(() => {
							var e;
							return (e = o.data) == null ? void 0 : e.archived;
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = o.data) == null ? void 0 : e.archived) ==
								null
								? void 0
								: l.length;
						}),
					}),
					f.push({
						label: "Private",
						batches: m(() => {
							var e;
							return (e = o.data) == null ? void 0 : e.private;
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = o.data) == null ? void 0 : e.private) ==
								null
								? void 0
								: l.length;
						}),
					})),
				d.data &&
					f.push({
						label: "Enrolled",
						batches: m(() => {
							var e;
							return (e = o.data) == null ? void 0 : e.enrolled;
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = o.data) == null ? void 0 : e.enrolled) ==
								null
								? void 0
								: l.length;
						}),
					}),
				(e, l) => {
					const w = j("router-link");
					return (
						n(),
						u("div", q, [
							a("header", G, [
								i(
									c(z),
									{
										class: "h-7",
										items: [
											{
												label: e.__("All Batches"),
												route: { name: "Batches" },
											},
										],
									},
									null,
									8,
									["items"]
								),
								a("div", H, [
									i(
										c(L),
										{ variant: "solid" },
										{
											prefix: h(() => [
												i(c(S), { class: "h-4 w-4" }),
											]),
											default: h(() => [
												_(
													" " + t(e.__("New Batch")),
													1
												),
											]),
											_: 1,
										}
									),
								]),
							]),
							a("div", Q, [
								i(
									c(P),
									{
										class: "overflow-hidden",
										modelValue: v.value,
										"onUpdate:modelValue":
											l[0] ||
											(l[0] = (r) => (v.value = r)),
										tabs: f,
									},
									{
										tab: h(({ tab: r, selected: b }) => [
											a("div", null, [
												a(
													"button",
													{
														class: $([
															"group -mb-px flex items-center gap-2 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
															{
																"text-gray-900":
																	b,
															},
														]),
													},
													[
														r.icon
															? (n(),
															  g(N(r.icon), {
																	key: 0,
																	class: "h-5",
															  }))
															: x("", !0),
														_(
															" " +
																t(
																	e.__(
																		r.label
																	)
																) +
																" ",
															1
														),
														i(
															c(y),
															{
																class: $({
																	"text-gray-900 border border-gray-900":
																		b,
																}),
																variant:
																	"subtle",
																theme: "gray",
																size: "sm",
															},
															{
																default: h(
																	() => [
																		_(
																			t(
																				r.count
																			),
																			1
																		),
																	]
																),
																_: 2,
															},
															1032,
															["class"]
														),
													],
													2
												),
											]),
										]),
										default: h(({ tab: r }) => [
											r.batches && r.batches.value.length
												? (n(),
												  u("div", W, [
														(n(!0),
														u(
															V,
															null,
															M(
																r.batches.value,
																(b) => (
																	n(),
																	g(
																		w,
																		{
																			to: {
																				name: "BatchDetail",
																				params: {
																					batchName:
																						b.name,
																				},
																			},
																		},
																		{
																			default:
																				h(
																					() => [
																						i(
																							Z,
																							{
																								batch: b,
																							},
																							null,
																							8,
																							[
																								"batch",
																							]
																						),
																					]
																				),
																			_: 2,
																		},
																		1032,
																		["to"]
																	)
																)
															),
															256
														)),
												  ]))
												: (n(),
												  u("div", ee, [
														a("div", te, [
															a(
																"div",
																null,
																t(
																	e
																		.__(
																			"No {0} batches found"
																		)
																		.format(
																			r.label.toLowerCase()
																		)
																),
																1
															),
														]),
												  ])),
										]),
										_: 1,
									},
									8,
									["modelValue"]
								),
							]),
						])
					);
				}
			);
		},
	};
export { re as default };
