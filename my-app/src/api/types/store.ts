export type ApiStoreItem = {
  item_id: string;
  name: string;
  description?: string;
  category?: string;
  image_url?: string;
  status?: string;
  custom_order?: boolean;
  fulfillment_mode?: "purchase" | "request" | "sold_out" | "inactive" | string;
  can_purchase?: boolean;
  can_request_purchase?: boolean;
  display_stock?: number | null;
  price_cents: number;
  stock: number;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
};

export type ApiStoreOrder = {
  order_id: string;
  username: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
};

export type ApiStoreItemsResponse = {
  ok: boolean;
  items: ApiStoreItem[];
};

export type ApiStoreSaveBody = {
  item_id?: string;
  name: string;
  description?: string;
  category?: string;
  image_url?: string;
  custom_order?: boolean;
  price_cents: number;
  stock: number;
  status?: string;
};

export type ApiStorePurchaseBody = {
  item_id: string;
  quantity?: number;
};

export type ApiStorePurchaseResponse = {
  ok: boolean;
  order: ApiStoreOrder;
  item: ApiStoreItem;
  wallet?: Record<string, any>;
};
