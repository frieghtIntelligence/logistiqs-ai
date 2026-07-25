import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signup } from "~/auth";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"shipper" | "carrier">("shipper");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signup({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        company_name: company.trim(),
      });

      if (result.success) {
        document.cookie = `logistiqs_session=${result.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        window.location.href = result.user.role === "carrier" ? "/carrier" : "/shipper";
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 md:mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white font-bold text-sm shadow-sm">
              LI
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              LOGISTIQS<span className="text-orange-500">IQ</span>
            </span>
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Join the marketplace for Southern African freight.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8"
        >
          {error && (
            <div className="mb-6 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                I am a…
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("shipper")}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    role === "shipper"
                      ? "border-orange-500 bg-orange-900/20 text-orange-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  Shipper
                </button>
                <button
                  type="button"
                  onClick={() => setRole("carrier")}
                  className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    role === "carrier"
                      ? "border-orange-500 bg-orange-900/20 text-orange-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  Carrier
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Your name
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Company name
              </label>
              <input
                id="company"
                type="text"
                required
                placeholder="e.g. Kansanshi Mining PLC"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Choose a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-orange-500 hover:text-orange-400">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
