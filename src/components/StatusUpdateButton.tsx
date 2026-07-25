import { useState } from "react";
import { advanceLoadStatus, type Load, type LoadStatus } from "~/api";

interface StatusUpdateButtonProps {
  load: Load;
  userRole: "shipper" | "carrier";
  userId: string;
  onStatusUpdated: (updatedLoad: Load) => void;
}

interface ActionDef {
  targetStatus: LoadStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CARRIER_ACTIONS: Record<string, ActionDef[]> = {
  accepted: [
    {
      targetStatus: "departed",
      label: "Mark as Departed",
      description: "Confirm the truck has left the pickup location.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      ),
    },
  ],
  departed: [
    {
      targetStatus: "in-transit",
      label: "Begin Transit",
      description: "Confirm the truck is on the main route.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 14.652v-4.993" />
        </svg>
      ),
    },
  ],
  "in-transit": [
    {
      targetStatus: "border-crossing",
      label: "At Border",
      description: "The truck is at a border crossing.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      ),
    },
    {
      targetStatus: "arrived",
      label: "Mark as Arrived",
      description: "The truck has arrived at the destination.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      ),
    },
  ],
  "border-crossing": [
    {
      targetStatus: "in-transit",
      label: "Clear Border",
      description: "The truck has cleared the border and is back in transit.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 14.652v-4.993" />
        </svg>
      ),
    },
  ],
  arrived: [
    {
      targetStatus: "delivered",
      label: "Confirm Delivery",
      description: "The shipment has been delivered and signed for.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
  ],
};

export function StatusUpdateButton({
  load,
  userRole,
  userId,
  onStatusUpdated,
}: StatusUpdateButtonProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  // Only the assigned carrier can update status
  const isCarrier = userRole === "carrier";
  const isAssignedCarrier = isCarrier && load.carrierId === userId;

  if (load.status === "delivered" || load.status === "posted") {
    // Delivered: nothing more to do. Posted: only show for shipper (no action yet)
    return null;
  }

  if (!isAssignedCarrier) {
    // Shipper view: read-only, show contact carrier prompt
    if (userRole === "shipper" && load.carrierName) {
      return (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3">
          <p className="text-sm text-gray-400">
            Status updates are managed by{" "}
            <span className="font-medium text-white">{load.carrierName}</span>.
          </p>
        </div>
      );
    }
    return null;
  }

  const actions = CARRIER_ACTIONS[load.status];
  if (!actions || actions.length === 0) return null;

  const handleStatusUpdate = async (targetStatus: LoadStatus) => {
    setUpdating(targetStatus);
    setMessage("");
    try {
      const updated = await advanceLoadStatus({ loadId: load.id, status: targetStatus });
      if (updated) {
        setMessage(`Status updated to "${targetStatus}".`);
        setMessageType("success");
        onStatusUpdated(updated);
      } else {
        setMessage("Could not update status. Please try again.");
        setMessageType("error");
      }
    } catch (e) {
      console.error("Status update error:", e);
      setMessage("Failed to update status.");
      setMessageType("error");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="mt-6 space-y-3">
      {message && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            messageType === "success"
              ? "border-emerald-800 bg-emerald-900/30 text-emerald-300"
              : "border-red-800 bg-red-900/30 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      {actions.map((action) => (
        <button
          key={action.targetStatus}
          disabled={updating !== null}
          onClick={() => handleStatusUpdate(action.targetStatus)}
          className="flex w-full items-center gap-3 rounded-xl bg-gray-800 px-4 py-3 text-left transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="shrink-0 text-orange-400">
            {updating === action.targetStatus ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              action.icon
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{action.label}</p>
            <p className="text-xs text-gray-400">{action.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
