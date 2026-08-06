import { useState } from 'react';
import { Book } from '../types/book.types';
import { invoke } from '@tauri-apps/api/core';

interface UseBookStateProps {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  selectedBookId?: number | null;
  setSelectedBookId?: (id: number | null) => void;
}

export function useBookState({ showToast: _showToast, selectedBookId, setSelectedBookId }: UseBookStateProps) {
  const [books, setBooks] = useState<Book[]>([]);

  const loadBooks = async () => {
    try {
      const data = await invoke<Book[]>('get_books');
      setBooks(data || []);
    } catch (error) {
      console.error('Failed to load books:', error);
    }
  };

  const addBook = async (book: Book) => {
    try {
      const id = await invoke<number>('add_book', { book });
      await loadBooks();
      return id;
    } catch (error) {
      console.error('Failed to add book:', error);
      throw error;
    }
  };

  const deleteBook = async (id: number) => {
    try {
      await invoke('delete_book', { id });
      await loadBooks();
    } catch (error) {
      console.error('Failed to delete book:', error);
      throw error;
    }
  };

  const updateBook = async (book: Book) => {
    try {
      await invoke('update_book', { book });
      await loadBooks();
    } catch (error) {
      console.error('Failed to update book:', error);
      throw error;
    }
  };

  return {
    books,
    loadBooks,
    addBook,
    deleteBook,
    updateBook,
    selectedBookId,
    setSelectedBookId
  };
}
