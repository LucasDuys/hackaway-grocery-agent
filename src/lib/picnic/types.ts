/** Raw API response types from the Picnic hackathon endpoints. */

export interface PicnicAuthPayload {
  "pc:2fa": "NOT_REQUIRED" | "NOT_VERIFIED";
  exp: number;
  [key: string]: unknown;
}

export interface PicnicApiError {
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}

/** Shape returned by hackathon-list-orders */
export interface RawOrderResponse {
  orders?: Array<{
    delivery_id: string;
    delivery_time: number;
    status: string;
    items: Array<{
      selling_unit_id: string;
      name: string;
      quantity: number;
      price: number;
      image_url?: string;
    }>;
  }>;
}

/** Shape returned by hackathon-list-favorites */
export interface RawFavoritesResponse {
  favorites?: Array<{
    selling_unit_id: string;
    name: string;
    price: number;
    image_url?: string;
    unit_quantity?: string;
  }>;
}

/** Shape returned by hackathon-get-cart */
export interface RawCartResponse {
  items?: Array<{
    selling_unit_id: string;
    name: string;
    quantity: number;
    price: number;
    image_url?: string;
  }>;
}

/** Shape returned by hackathon-get-delivery-slots */
export interface RawDeliverySlotsResponse {
  delivery_slots?: Array<{
    slot_id: string;
    window_start: string;
    window_end: string;
    is_available: boolean;
  }>;
}

/** Shape returned by hackathon-search-products */
export interface RawSearchProductsResponse {
  products?: Array<{
    selling_unit_id: string;
    name: string;
    price: number;
    image_url?: string;
    unit_quantity?: string;
  }>;
}

/** Shape returned by hackathon-search-recipes */
export interface RawSearchRecipesResponse {
  recipes?: Array<{
    id: string;
    name: string;
    portions: number;
    images?: {
      images?: Array<{
        id: string;
        type?: string;
        namespace?: string;
        primary?: boolean;
      }>;
    };
    ingredients?: Array<{
      ingredient_id: string;
      ingredient_type?: string;
      name: string;
      selling_unit_id?: string | null;
      selling_unit_quantity: number;
      order?: number;
      availability_status?: string;
    }> | null;
  }>;
}
