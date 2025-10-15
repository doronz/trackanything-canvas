import React from 'react';
import { PaginationState } from './types';

interface PaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export default function Pagination({
  pagination,
  onPageChange,
  onNextPage,
  onPrevPage,
}: PaginationProps) {
  const { currentPage, totalPages, totalCount, hasNext, hasPrev, perPage } = pagination;

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, totalCount)}{' '}
        of {totalCount} servers
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onPrevPage}
          disabled={!hasPrev}
          className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={onNextPage}
          disabled={!hasNext}
          className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
