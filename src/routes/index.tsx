import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-950 to-gray-900">
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
              </span>
              Now connecting Southern Africa
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Smart Freight for{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Southern Africa
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-300 sm:text-xl">
              LOGISTIQS INTELLIGENCE connects mining companies, manufacturers,
              and distributors with trusted carriers across the region. Post a
              load, find freight, and track every shipment — all in one
              platform.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/shipper"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:shadow-orange-500/40 sm:w-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Post a Load
              </Link>
              <Link
                to="/carrier"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-600 bg-white/10 px-8 py-3.5 text-base font-semibold text-white backdrop-blur transition-all hover:border-gray-500 hover:bg-white/20 sm:w-auto"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Find Loads
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value Props ──────────────────────────────────── */}
      <section className="bg-white py-20 dark:bg-gray-950 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Built for heavy industry
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              From copper belts to coal fields — LOGISTIQS handles the loads
              that power the continent.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Post Freight Instantly",
                desc: "Create a load in under 60 seconds. Specify origin, destination, cargo type, and timeline — carriers see it immediately.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7.5L12 3l9 4.5M3 7.5v9l9 4.5 9-4.5v-9M3 7.5l9 4.5 9-4.5"
                    />
                  </svg>
                ),
              },
              {
                title: "Find Quality Loads",
                desc: "Browse available freight across Southern Africa on an interactive map or list. Filter by cargo, weight, and route.",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                ),
              },
              {
                title: "Live Tracking",
                desc: "Track shipments in real time with GPS. Know exactly where your cargo is — from pickup to delivery. (Coming in v2)",
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-7 w-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                    />
                  </svg>
                ),
              },
            ].map((prop) => (
              <div
                key={prop.title}
                className="group rounded-2xl border border-gray-200 bg-gray-50/50 p-8 transition-all hover:border-orange-200 hover:bg-orange-50/50 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-orange-800 dark:hover:bg-orange-950/20"
              >
                <div className="mb-4 inline-flex rounded-xl bg-orange-100 p-3 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                  {prop.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {prop.title}
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {prop.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────── */}
      <section className="bg-gray-50 py-20 dark:bg-gray-900/50 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              How it works
            </h2>
          </div>
          <div className="mt-16 grid gap-12 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Shippers post loads",
                desc: "Enter your cargo details, origin, destination, and timeline. Your load goes live instantly on the marketplace.",
              },
              {
                step: "02",
                title: "Carriers accept",
                desc: "Browse available loads on the map or list. Accept the ones that match your route and capacity — one click.",
              },
              {
                step: "03",
                title: "Track & deliver",
                desc: "Monitor shipment progress with live GPS. Confirm delivery and keep the supply chain moving.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cargo Types ─────────────────────────────────── */}
      <section className="bg-white py-20 dark:bg-gray-950 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              We move what matters
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              From bulk minerals to refined fuel — our carriers handle every
              cargo type across the region.
            </p>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {[
              "Coal",
              "Copper",
              "Iron Ore",
              "Fuel & Diesel",
              "Grain & Maize",
              "Machinery",
              "General Freight",
              "Cement",
              "Steel",
              "Fertilizer",
            ].map((cargo) => (
              <span
                key={cargo}
                className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {cargo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-gray-50 py-10 dark:border-gray-800 dark:bg-gray-900/80">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            &copy; {new Date().getFullYear()} LOGISTIQS INTELLIGENCE. Connecting
            Southern Africa&apos;s supply chain.
          </p>
        </div>
      </footer>
    </div>
  );
}
