import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { closeModal } from '@/store/uiSlice';
import BaseModal from './BaseModal';
import { CogIcon } from '@heroicons/react/24/outline';

interface PlaceholderModalProps {
  isOpen: boolean;
  modalType: string;
  title: string;
  description: string;
}

export default function PlaceholderModal({
  isOpen,
  modalType,
  title,
  description,
}: PlaceholderModalProps) {
  const dispatch = useDispatch<AppDispatch>();

  const handleClose = () => {
    dispatch(closeModal(modalType as any));
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title={title} size="md">
      <div className="text-center py-8">
        <CogIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{description}</p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This feature is coming soon! The modal functionality is working correctly.
          </p>
        </div>
        <button
          onClick={handleClose}
          className="mt-6 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Close
        </button>
      </div>
    </BaseModal>
  );
}
