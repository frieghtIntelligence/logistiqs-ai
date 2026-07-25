import type { LoadStatus, StatusHistoryEntry } from "~/api";

interface TimelineStep {
  status: LoadStatus;
  label: string;
  icon: React.ReactNode;
}

const STEPS: TimelineStep[] = [
  {
    status: "posted",
    label: "Load Posted",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    status: "accepted",
    label: "Carrier Accepted",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
  {
    status: "departed",
    label: "Departed Origin",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    status: "in-transit",
    label: "In Transit",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 14.652v-4.993" />
      </svg>
    ),
  },
  {
    status: "border-crossing",
    label: "Border Crossing",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    status: "arrived",
    label: "Arrived Destination",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    status: "delivered",
    label: "Delivered",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

// The canonical order of statuses
const STATUS_ORDER: LoadStatus[] = [
  "posted",
  "accepted",
  "departed",
  "in-transit",
  "border-crossing",
  "arrived",
  "delivered",
];

interface ShipmentTimelineProps {
  currentStatus: LoadStatus;
  statusHistory: StatusHistoryEntry[];
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts + "Z");
  return d.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShipmentTimeline({
  currentStatus,
  statusHistory,
}: ShipmentTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const historyMap = new Map<string, StatusHistoryEntry>();
  for (const h of statusHistory) {
    historyMap.set(h.status, h);
  }

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.status);
        const isCompleted = stepIdx < currentIndex;
        const isActive = stepIdx === currentIndex;
        const isFuture = stepIdx > currentIndex;
        const historyEntry = historyMap.get(step.status);

        return (
          <div key={step.status} className="flex gap-4">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isActive
                    ? "border-orange-500 text-orange-400"
                    : isCompleted
                      ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                      : "border-gray-700 text-gray-500"
                }`}
              >
                {step.icon}
              </div>
              {/* Connector line (except last step) */}
              {i < STEPS.length - 1 && (
                <div
                  className={`h-10 w-0.5 ${
                    isCompleted ? "bg-emerald-600" : "bg-gray-800"
                  }`}
                />
              )}
            </div>
            {/* Content */}
            <div className="pb-6">
              <p
                className={`text-sm font-medium leading-tight ${
                  isActive
                    ? "text-orange-400"
                    : isCompleted
                      ? "text-emerald-400"
                      : "text-gray-500"
                }`}
              >
                {step.label}
                {isActive && (
                  <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse align-middle" />
                )}
              </p>
              {historyEntry && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatTimestamp(historyEntry.timestamp)}
                </p>
              )}
              {isFuture && !historyEntry && (
                <p className="mt-0.5 text-xs text-gray-600">Pending</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
