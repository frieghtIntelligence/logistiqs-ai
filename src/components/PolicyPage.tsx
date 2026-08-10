import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PolicyPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-gray-50 px-4 py-16 dark:bg-gray-950 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-10">
        <Link
          to="/"
          className="text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
        >
          ← Back to LOGISTIQS
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
          LOGISTIQS INTELLIGENCE
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {updated}
        </p>
        <p className="mt-8 text-lg leading-8 text-gray-700 dark:text-gray-300">
          {intro}
        </p>
        <div className="policy-content mt-10 space-y-8 text-gray-700 dark:text-gray-300">
          {children}
        </div>
      </article>
    </main>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-7">{children}</div>
    </section>
  );
}

export const policyContact = (
  <p>
    Questions about this policy or a data request can be sent to{" "}
    <a
      className="font-medium text-orange-600 hover:underline dark:text-orange-400"
      href="mailto:logistiqs@logistiqs.live"
    >
      logistiqs@logistiqs.live
    </a>
    .
  </p>
);
