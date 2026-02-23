export interface User {
  id: number;
  email: string;
  role: 'admin' | 'visitor';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  parent_id: number | null;
  user_id: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  children?: Category[];
}

export interface Link {
  id: number;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  icon_orig: string | null;
  category_id: number;
  user_id: number;
  sort_order: number;
  is_recommended?: boolean;
  click_count: number;
  last_clicked_at: string | null;
  last_check_status?: number | null;
  last_check_time?: string | null;
  last_response_time?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  categories: string[];
}
