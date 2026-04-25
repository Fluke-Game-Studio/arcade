export type ApiEndpointSchema = Record<string, unknown>;

export type ApiEndpointCatalogItem = {
  routeKey: string;
  method: string;
  path: string;
  module?: string;
  description?: string;
  auth?: string;
  authMode?: string;
  schema?: ApiEndpointSchema;
  allowedUsers?: string[];
  deniedUsers?: string[];
  allowedProjects?: string[];
  deniedProjects?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastSeenAt?: string;
};

export type GetEndpointCatalogResponse = {
  ok: boolean;
  count: number;
  endpoints: ApiEndpointCatalogItem[];
};

export type UpdateEndpointAccessBody = {
  routeKey: string;
  authMode?: "public" | "employee" | "admin" | "super" | "authenticated";
  allowedUsers?: string[];
  deniedUsers?: string[];
  allowedProjects?: string[];
  deniedProjects?: string[];
};

export type UpdateEndpointAccessResponse = {
  ok: boolean;
  item: ApiEndpointCatalogItem;
};
