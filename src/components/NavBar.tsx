import { Link } from "@tanstack/react-router";

export function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-800 dark:bg-gray-950/95 dark:supports-[backdrop-filter]:bg-gray-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white font-bold text-sm shadow-sm">
            LI
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            LOGISTIQS<span className="text-orange-500">IQ</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            activeProps={{ className: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" }}
          >
            Home
          </Link>
          <Link
            to="/shipper"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            activeProps={{ className: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" }}
          >
            Ship Freight
          </Link>
          <Link
            to="/carrier"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            activeProps={{ className: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100" }}
          >
            Find Loads
          </Link>
        </nav>
      </div>
    </header>
  );
}
