import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

type HttpMethod = "delete" | "get" | "patch" | "post" | "put";

type OpenApiOperation = {
  operationId?: unknown;
  parameters?: unknown;
  summary?: unknown;
  "x-repo-guardian-request-type"?: unknown;
  "x-repo-guardian-response-type"?: unknown;
};

type OpenApiDocument = {
  paths?: Record<string, Partial<Record<HttpMethod, OpenApiOperation>>>;
};

type ClientOperation = {
  functionName: string;
  method: string;
  path: string;
  queryParameters: Array<{
    name: string;
    required: boolean;
  }>;
  requestType: string | null;
  responseType: string;
  pathParameters: string[];
};

const httpMethods = new Set<HttpMethod>(["delete", "get", "patch", "post", "put"]);
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specPath = resolve(rootDir, "openapi.yaml");
const outputPath = resolve(rootDir, "..", "api-client", "src", "generated", "client.ts");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPathParameters(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/gu)].map((match) => match[1] ?? "");
}

function getQueryParameters(parameters: unknown): Array<{
  name: string;
  required: boolean;
}> {
  if (!Array.isArray(parameters)) {
    return [];
  }

  return parameters.flatMap((parameter) => {
    if (!isRecord(parameter)) {
      return [];
    }

    if (parameter.in !== "query" || typeof parameter.name !== "string") {
      return [];
    }

    return [
      {
        name: parameter.name,
        required: parameter.required === true
      }
    ];
  });
}

function toOperation(
  path: string,
  method: string,
  operation: OpenApiOperation
): ClientOperation {
  if (typeof operation.operationId !== "string") {
    throw new Error(`${method.toUpperCase()} ${path} is missing operationId.`);
  }

  if (typeof operation["x-repo-guardian-response-type"] !== "string") {
    throw new Error(
      `${method.toUpperCase()} ${path} is missing x-repo-guardian-response-type.`
    );
  }

  const requestType = operation["x-repo-guardian-request-type"];

  if (requestType !== undefined && typeof requestType !== "string") {
    throw new Error(
      `${method.toUpperCase()} ${path} has an invalid x-repo-guardian-request-type.`
    );
  }

  return {
    functionName: operation.operationId,
    method: method.toUpperCase(),
    path,
    pathParameters: getPathParameters(path),
    queryParameters: getQueryParameters(operation.parameters),
    requestType: requestType ?? null,
    responseType: operation["x-repo-guardian-response-type"]
  };
}

function collectOperations(document: OpenApiDocument): ClientOperation[] {
  const operations: ClientOperation[] = [];

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method as HttpMethod) || !operation) {
        continue;
      }

      operations.push(toOperation(path, method, operation));
    }
  }

  return operations.sort((left, right) =>
    `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`)
  );
}

function buildFunction(operation: ClientOperation): string {
  const pathParameterArgs = operation.pathParameters
    .map((parameter) => `${parameter}: string`)
    .join(", ");
  const queryArg =
    operation.queryParameters.length > 0
      ? `query: { ${operation.queryParameters
          .map(
            (parameter) =>
              `"${parameter.name}"${parameter.required ? "" : "?"}: string | number | boolean | readonly (string | number | boolean)[]`
          )
          .join("; ")} }`
      : "";
  const bodyArg = operation.requestType
    ? `requestBody: ${operation.requestType}`
    : "";
  const args = [pathParameterArgs, queryArg, bodyArg, "options: RepoGuardianApiRequestOptions = {}"]
    .filter((arg) => arg.length > 0)
    .join(", ");
  const encodedPath = operation.pathParameters.reduce(
    (currentPath, parameter) =>
      currentPath.replace(
        `{${parameter}}`,
        `\${encodeURIComponent(${parameter})}`
      ),
    operation.path
  );
  const bodyLine = operation.requestType
    ? "\n    body: requestBody,"
    : "";
  const queryLine =
    operation.queryParameters.length > 0
      ? "\n    query,"
      : "";

  return `export async function ${operation.functionName}(${args}): Promise<${operation.responseType}> {
  return requestJson<${operation.responseType}>({
    method: "${operation.method}",
    path: \`${encodedPath}\`,${queryLine}${bodyLine}
    options
  });
}
`;
}

function buildClientSource(operations: ClientOperation[]): string {
  const typeNames = [...new Set(
    operations.flatMap((operation) =>
      operation.requestType
        ? [operation.requestType, operation.responseType]
        : [operation.responseType]
    )
  )].sort((left, right) => left.localeCompare(right));
  const functions = operations.map(buildFunction).join("\n");

  return `// Generated by @repo-guardian/api-spec. Do not edit by hand.
import type {
  ${typeNames.join(",\n  ")}
} from "@repo-guardian/shared-types";

export type RepoGuardianApiRequestOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export class RepoGuardianApiError extends Error {
  readonly details: unknown;
  readonly status: number;

  constructor(message: string, status: number, details: unknown, options?: ErrorOptions) {
    super(message, options);
    this.name = "RepoGuardianApiError";
    this.status = status;
    this.details = details;
  }
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createRequestHeaders(input: {
  body?: unknown;
  headers?: HeadersInit;
}): HeadersInit | undefined {
  if (input.body === undefined) {
    return input.headers;
  }

  const headers = new Headers(input.headers);
  headers.set("Content-Type", "application/json");

  return headers;
}

function buildQueryString(
  query: Record<string, string | number | boolean | readonly (string | number | boolean)[]> | undefined
): string {
  if (!query) {
    return "";
  }

  const searchParams = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      searchParams.append(key, String(value));
    }
  }

  const serialized = searchParams.toString();
  return serialized.length > 0 ? \`?\${serialized}\` : "";
}

async function requestJson<TResponse>(input: {
  body?: unknown;
  method: string;
  options: RepoGuardianApiRequestOptions;
  path: string;
  query?: Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
}): Promise<TResponse> {
  const fetchImpl = input.options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    \`\${input.options.baseUrl ?? ""}\${input.path}\${buildQueryString(input.query)}\`,
    {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    headers: createRequestHeaders({
      body: input.body,
      headers: input.options.headers
    }),
    method: input.method,
    signal: input.options.signal
    }
  );
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new RepoGuardianApiError(
      getErrorMessage(payload, \`Repo Guardian API request failed with status \${response.status}\`),
      response.status,
      payload
    );
  }

  return payload as TResponse;
}

${functions}`;
}

const specContent = await readFile(specPath, "utf8");
const parsedSpec = parse(specContent);

if (!isRecord(parsedSpec)) {
  throw new Error("OpenAPI document must be an object.");
}

const operations = collectOperations(parsedSpec as OpenApiDocument);

if (operations.length === 0) {
  throw new Error("OpenAPI document does not define client operations.");
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, buildClientSource(operations), "utf8");
