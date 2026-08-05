import toast from "react-hot-toast";

export type ToastType = "success" | "error" | "warning";

const TOAST_DURATIONS = {
  success: 5000,
  error: 7000,
  warning: 6000,
} as const;

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
};

export function showToastWithOK(
  message: string,
  type: ToastType = "success",
): void {
  toast.custom(
    (t) => (
      <div className={`toast-item toast-item-${type}`}>
        <span className="toast-icon">{TOAST_ICONS[type]}</span>
        <span className={`toast-message toast-message-${type}`}>{message}</span>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className={`toast-ok-button toast-ok-button-${type}`}
        >
          ОК
        </button>
      </div>
    ),
    {
      duration: TOAST_DURATIONS[type],
      position: "top-center",
      className: "custom-toast-wrapper",
    },
  );
}
