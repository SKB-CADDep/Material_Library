import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api",
  headers: { "Content-Type": "application/json; charset=utf-8" },
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err.response?.data?.detail;
    let message = "Ошибка API";
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      message = detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String((item as { msg: string }).msg)
            : String(item),
        )
        .join("; ");
    } else if (err.message) {
      message = err.message;
    }
    return Promise.reject(new Error(message));
  }
);