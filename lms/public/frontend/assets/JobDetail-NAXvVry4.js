import {
	d as n,
	k as _,
	y as m,
	C as s,
	G as o,
	H as e,
	A as p,
	B as r,
	J as u,
	x as c,
	a6 as d,
	U as b,
	I as f,
	a7 as h,
} from "./frappe-ui-20hnMCM8.js";
import { P as x } from "./plus-pxSjkL_w.js";
import "./index-Vx7mSx23.js";
const j = { class: "text-base h-screen" },
	y = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	k = { class: "flex" },
	w = s("div", null, null, -1),
	V = {
		__name: "JobDetail",
		props: { job: { type: String, required: !0 } },
		setup(i) {
			const l = n("$user");
			return (
				_({
					url: "lms.lms.api.get_job_details",
					params: { job: i.job },
					cache: ["job"],
					auto: !0,
				}),
				(t, J) => {
					var a;
					return (
						c(),
						m("div", j, [
							s("header", y, [
								o(
									e(d),
									{
										class: "h-7",
										items: [
											{
												label: t.__("Jobs"),
												route: { name: "Jobs" },
											},
										],
									},
									null,
									8,
									["items"]
								),
								s("div", k, [
									(a = e(l).data) != null && a.name
										? (c(),
										  p(
												e(h),
												{ key: 0, variant: "solid" },
												{
													prefix: r(() => [
														o(e(x), {
															class: "h-4 w-4",
														}),
													]),
													default: r(() => [
														b(
															" " +
																f(
																	t.__(
																		"New Job"
																	)
																),
															1
														),
													]),
													_: 1,
												}
										  ))
										: u("", !0),
								]),
							]),
							w,
						])
					);
				}
			);
		},
	};
export { V as default };
//# sourceMappingURL=JobDetail-NAXvVry4.js.map
