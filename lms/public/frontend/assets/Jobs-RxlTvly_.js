import {
	d as f,
	x as a,
	y as c,
	H as e,
	L as n,
	a4 as u,
	J as l,
	K as s,
	a8 as h,
	G as r,
	k as y,
	F as p,
	M as _,
	Q as g,
	R as v,
	a6 as x,
	a7 as k,
	W as $,
} from "./frappe-ui-n1bXVQkV.js";
import { M as w } from "./map-pin-Ko1oZ6mp.js";
import { P as J } from "./plus-w56hNznP.js";
import "./index-xt-hKVBz.js";
const M = { class: "flex shadow rounded-md p-4 h-full" },
	N = ["src"],
	B = { class: "text-xl font-semibold mb-2" },
	C = { class: "font-medium" },
	D = { class: "flex items-center my-4" },
	V = { class: "font-medium" },
	Y = {
		__name: "JobCard",
		props: { job: { type: Object, default: null } },
		setup(t) {
			const i = f("$dayjs");
			return (o, d) => (
				a(),
				c("div", M, [
					e(
						"img",
						{
							src: t.job.company_logo,
							class: "w-12 h-12 rounded-lg object-contain mr-4",
						},
						null,
						8,
						N
					),
					e("div", null, [
						e("div", B, n(t.job.job_title), 1),
						e("div", null, [
							u(n(o.__("posted by")) + " ", 1),
							e("span", C, n(t.job.company_name), 1),
						]),
						e("div", D, [
							l(
								s(h),
								{
									label: t.job.type,
									theme: "green",
									size: "lg",
									class: "mr-4",
								},
								null,
								8,
								["label"]
							),
							l(
								s(h),
								{
									label: t.job.location,
									theme: "gray",
									size: "lg",
								},
								{
									prefix: r(() => [
										l(s(w), {
											class: "h-4 w-4 stroke-1.5",
										}),
									]),
									_: 1,
								},
								8,
								["label"]
							),
						]),
						e("div", null, [
							u(n(o.__("posted on")) + " ", 1),
							e(
								"span",
								V,
								n(s(i)(t.job.creation).format("DD MMM YYYY")),
								1
							),
						]),
					]),
				])
			);
		},
	},
	z = { class: "h-screen text-base" },
	P = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	F = { class: "flex" },
	L = { key: 0 },
	R = { class: "grid grid-cols-2 gap-5 p-5" },
	Q = {
		__name: "Jobs",
		setup(t) {
			const i = f("$user"),
				o = y({
					url: "lms.lms.api.get_job_opportunities",
					cache: ["jobs"],
					auto: !0,
				});
			return (d, E) => {
				var b;
				const j = $("router-link");
				return (
					a(),
					c("div", z, [
						e("header", P, [
							l(
								s(x),
								{
									class: "h-7",
									items: [
										{
											label: d.__("Jobs"),
											route: { name: "Jobs" },
										},
									],
								},
								null,
								8,
								["items"]
							),
							e("div", F, [
								(b = s(i).data) != null && b.name
									? (a(),
									  p(
											s(k),
											{ key: 0, variant: "solid" },
											{
												prefix: r(() => [
													l(s(J), {
														class: "h-4 w-4",
													}),
												]),
												default: r(() => [
													u(
														" " +
															n(d.__("New Job")),
														1
													),
												]),
												_: 1,
											}
									  ))
									: _("", !0),
							]),
						]),
						s(o).data
							? (a(),
							  c("div", L, [
									e("div", R, [
										s(o).data.length
											? (a(!0),
											  c(
													g,
													{ key: 0 },
													v(
														s(o).data,
														(m) => (
															a(),
															c("div", null, [
																(a(),
																p(
																	j,
																	{
																		to: {
																			name: "JobDetail",
																			params: {
																				job: m.name,
																			},
																		},
																		key: m.name,
																	},
																	{
																		default:
																			r(
																				() => [
																					l(
																						Y,
																						{
																							job: m,
																						},
																						null,
																						8,
																						[
																							"job",
																						]
																					),
																				]
																			),
																		_: 2,
																	},
																	1032,
																	["to"]
																)),
															])
														)
													),
													256
											  ))
											: _("", !0),
									]),
							  ]))
							: _("", !0),
					])
				);
			};
		},
	};
export { Q as default };
//# sourceMappingURL=Jobs-RxlTvly_.js.map
