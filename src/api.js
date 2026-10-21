let csrf = null;
export function setCsrf(value) {
  csrf = value;
}
export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "No se pudo completar la petición.");
  return data;
}
export const post = (path, body = {}) => api(path, { method: "POST", body });
export async function upload(file, query) {
  const body = new FormData();
  body.append("image", file);
  return api("/images?" + new URLSearchParams(query), { method: "POST", body });
}
