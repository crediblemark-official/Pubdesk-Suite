/**
 * Tipe data domain: Buku dan Proyek
 */

export interface Book {
  id?: number;
  title: string;
  isbn?: string;
  regular_price: number;
  po_price: number;
  weight_grams: number;
  author_id?: number;
  cover_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id?: number;
  title: string;
  book_id?: number;
  status: string;
  deadline?: string;
  created_at?: string;
  updated_at?: string;
}
