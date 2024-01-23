import {
	a as C,
	x as n,
	y as u,
	A as g,
	B as h,
	H as t,
	U as f,
	G as c,
	a8 as x,
	I as y,
	J as a,
	F as i,
	k as Y,
	r as j,
	j as m,
	C as $,
	M as D,
	Q as M,
	R as N,
	W as V,
	a6 as z,
	a7 as A,
	a9 as L,
} from "./frappe-ui-iPT8hMkb.js";
import { B as O, f as B } from "./index-qZ7Yta4u.js";
import { C as P, a as S } from "./clock-z0R6Od6V.js";
import { P as U } from "./plus-_m-8cMp1.js";
const E = {
		class: "flex flex-col border border-gray-200 rounded-md p-4 h-full",
		style: { "min-height": "150px" },
	},
	F = { class: "text-xl font-semibold mb-1" },
	I = { class: "short-introduction" },
	R = { class: "mt-auto" },
	T = { key: 0, class: "font-semibold text-lg mb-4" },
	G = { class: "flex items-center mb-3" },
	H = { class: "flex items-center mb-3" },
	J = { class: "flex items-center" },
	Q = {
		__name: "BatchCard",
		props: { batch: { type: Object, default: null } },
		setup(s) {
			const d = C("$dayjs");
			return (o, v) => (
				n(),
				u("div", E, [
					s.batch.seat_count && s.batch.seats_left > 0
						? (n(),
						  g(
								c(x),
								{
									key: 0,
									theme: "green",
									class: "self-start mb-2",
								},
								{
									default: h(() => [
										f(
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
								c(x),
								{
									key: 1,
									theme: "red",
									class: "self-start mb-2",
								},
								{
									default: h(() => [
										f(t(o.__("Sold Out")), 1),
									]),
									_: 1,
								}
						  ))
						: y("", !0),
					a("div", F, t(s.batch.title), 1),
					a("div", I, t(s.batch.description), 1),
					a("div", R, [
						s.batch.amount
							? (n(), u("div", T, t(s.batch.price), 1))
							: y("", !0),
						a("div", G, [
							i(c(O), {
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
						a("div", H, [
							i(c(P), {
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
						a("div", J, [
							i(c(S), {
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
	W = { class: "h-screen text-base" },
	q = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	K = { class: "flex" },
	X = { class: "mx-5 py-5" },
	Z = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-8 mt-5",
	},
	ee = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	te = { class: "flex flex-col items-center justify-center mt-4" },
	oe = {
		__name: "Batches",
		setup(s) {
			var p, k;
			const d = C("$user"),
				o = Y({
					url: "lms.lms.utils.get_batches",
					cache: [
						"batches",
						(p = d == null ? void 0 : d.data) == null
							? void 0
							: p.email,
					],
					auto: !0,
				}),
				v = j(0),
				_ = [
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
					(_.push({
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
					_.push({
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
					_.push({
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
					const w = V("router-link");
					return (
						n(),
						u("div", W, [
							a("header", q, [
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
								a("div", K, [
									i(
										c(A),
										{ variant: "solid" },
										{
											prefix: h(() => [
												i(c(U), { class: "h-4 w-4" }),
											]),
											default: h(() => [
												f(
													" " + t(e.__("New Batch")),
													1
												),
											]),
											_: 1,
										}
									),
								]),
							]),
							a("div", X, [
								i(
									c(L),
									{
										class: "overflow-hidden",
										modelValue: v.value,
										"onUpdate:modelValue":
											l[0] ||
											(l[0] = (r) => (v.value = r)),
										tabs: _,
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
															  g(D(r.icon), {
																	key: 0,
																	class: "h-5",
															  }))
															: y("", !0),
														f(
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
															c(x),
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
																		f(
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
												  u("div", Z, [
														(n(!0),
														u(
															M,
															null,
															N(
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
																							Q,
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
export { oe as default };
//# sourceMappingURL=Batches-gDWZzuli.js.map
