export type ApiCustomer = {
  PK?: string;
  SK?: string;
  customer_id: string;
  name: string;
  customer_type: "internal" | "test" | "final" | string;
  status: "active" | "suspended" | "restricted" | string;
  billing_provider?: string;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ApiProduct = {
  product_id: string;
  project_id: string;
  name: string;
  release_status: "internal" | "candidate" | "released" | string;
  channel: "alpha" | "beta" | "stable" | string;
  platform?: string;
  status: "active" | "archived" | string;
};

export type CreateCustomerBody = {
  customer_id?: string;
  name: string;
  customer_type?: "internal" | "test" | "final";
  status?: "active" | "suspended" | "restricted";
  billing_provider?: string;
  stripe_customer_id?: string;
};

export type UpdateCustomerBody = Partial<CreateCustomerBody>;

export type CreateCustomerUserBody = {
  user_id?: string;
  email: string;
  password: string;
  role?: "owner" | "admin" | "member";
  status?: "active" | "disabled";
};

export type UpsertEntitlementBody = {
  product_id: string;
  tier?: string;
  env?: "dev" | "test" | "prod";
  status?: "active" | "paused" | "restricted" | "revoked";
  customer_type_scope?: string;
  allow_prod_override?: boolean;
  start_at?: string;
  end_at?: string;
};

export type CustomerFlowRow = Record<string, any>;
