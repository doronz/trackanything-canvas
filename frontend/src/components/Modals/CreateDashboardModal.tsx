import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createDashboard } from '@/store/dashboardSlice';
import { closeModal } from '@/store/uiSlice';
import BaseModal from './BaseModal';
import toast from 'react-hot-toast';

interface CreateDashboardModalProps {
  isOpen: boolean;
}

export default function CreateDashboardModal({ isOpen }: CreateDashboardModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    dispatch(closeModal('createDashboard'));
    setFormData({ name: '', description: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(
        createDashboard({
          name: formData.name.trim(),
          description: formData.description.trim(),
        })
      ).unwrap();

      toast.success('Dashboard created successfully!');
      handleClose();
    } catch (error) {
      toast.error('Failed to create dashboard');
      console.error('Error creating dashboard:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Dashboard"
      description="Create a new dashboard to organize your widgets and visualizations."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="dashboard-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Dashboard Name *
          </label>
          <input
            id="dashboard-name"
            type="text"
            value={formData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            placeholder="Enter dashboard name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            required
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="dashboard-description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Description
          </label>
          <textarea
            id="dashboard-description"
            value={formData.description}
            onChange={e => handleInputChange('description', e.target.value)}
            placeholder="Enter dashboard description (optional)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Dashboard'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
