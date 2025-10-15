import React from 'react';
import { TestResult } from './types';
import { XCircleIcon } from '@heroicons/react/24/outline';

interface ConfirmationDialogProps {
  isOpen: boolean;
  lastTestResult: TestResult | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({
  isOpen,
  lastTestResult,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <XCircleIcon className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Configuration Test Failed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The configuration test failed with the following error:
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                {lastTestResult?.message}
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to add this server anyway? It may not work correctly until the
              configuration is fixed.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Add Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
