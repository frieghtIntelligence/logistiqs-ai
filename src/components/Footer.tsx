import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-sm text-gray-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            LOGISTIQS INTELLIGENCE
          </p>
          <p className="mt-1">Freight coordination for Southern Africa.</p>
        </div>
        <nav aria-label="Policies" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link
            to="/privacy"
            className="hover:text-orange-600 hover:underline dark:hover:text-orange-400"
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="hover:text-orange-600 hover:underline dark:hover:text-orange-400"
          >
            Terms
          </Link>
          <Link
            to="/refunds"
            className="hover:text-orange-600 hover:underline dark:hover:text-orange-400"
          >
            Refunds
          </Link>
          <Link
            to="/acceptable-use"
            className="hover:text-orange-600 hover:underline dark:hover:text-orange-400"
          >
            Acceptable use
          </Link>
          <Link
            to="/contact"
            className="hover:text-orange-600 hover:underline dark:hover:text-orange-400"
          >
            Contact & data
          </Link>
        </nav>
      </div>
    </footer>
  );
}
