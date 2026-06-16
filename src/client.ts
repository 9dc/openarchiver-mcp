const BASE_URL = process.env.OPENARCHIVER_BASE_URL || "http://localhost:3000";
const API_KEY = process.env.OPENARCHIVER_API_KEY || "";

export class OpenArchiverError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "OpenArchiverError";
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    rawBody?: boolean;
  },
): Promise<T> {
  const url = new URL(`/api${path}`, BASE_URL);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (options?.rawBody && options?.body instanceof FormData) {
    // Let fetch set Content-Type for FormData
  } else if (options?.body && !options?.rawBody) {
    headers["Content-Type"] = "application/json";
  }
  if (API_KEY) {
    headers["X-API-KEY"] = API_KEY;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: options?.rawBody
      ? (options.body as FormData)
      : options?.body
        ? JSON.stringify(options.body)
        : undefined,
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const delay = retryAfter ? parseInt(retryAfter) * 1000 : 15000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return request<T>(method, path, options);
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const json = await response.json();
      if (json.message) message = json.message;
    } catch {
      // ignore parse errors
    }
    throw new OpenArchiverError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}

export function get(path: string, query?: Record<string, string | number | undefined>) {
  return request("GET", path, { query });
}

export function post(path: string, body?: unknown) {
  return request("POST", path, { body });
}

export function put(path: string, body?: unknown) {
  return request("PUT", path, { body });
}

export function patch(path: string, body?: unknown) {
  return request("PATCH", path, { body });
}

export function del(path: string) {
  return request("DELETE", path);
}

export function uploadFormData(body: FormData) {
  return request<{ filePath: string }>("POST", "/v1/upload", { body, rawBody: true });
}

export function download(path: string) {
  return request<ArrayBuffer>("GET", "/v1/storage/download", { query: { path } });
}

export function getJson<T>(path: string, query?: Record<string, string | number | undefined>) {
  return request<T>("GET", path, { query });
}

export function postJson<T>(path: string, body?: unknown) {
  return request<T>("POST", path, { body });
}

export function putJson<T>(path: string, body?: unknown) {
  return request<T>("PUT", path, { body });
}

export function patchJson<T>(path: string, body?: unknown) {
  return request<T>("PATCH", path, { body });
}

export function delJson<T>(path: string) {
  return request<T>("DELETE", path);
}