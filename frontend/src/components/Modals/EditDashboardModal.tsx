import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { updateDashboard } from '@/store/dashboardSlice';
import { closeModal } from '@/store/uiSlice';
import BaseModal from './BaseModal';
import toast from 'react-hot-toast';

interface EditDashboardModalProps {
  isOpen: boolean;
  dashboardId?: number;
}

export default function EditDashboardModal({ isOpen, dashboardId }: EditDashboardModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const dashboards = useSelector((state: RootState) => state.dashboard.dashboards);
  const dashboard = dashboards.find(d => d.id === dashboardId);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when dashboard changes
  useEffect(() => {
    if (dashboard) {
      setFormData({
        name: dashboard.name,
        description: dashboard.description || '',
      });
    }
  }, [dashboard]);

  const handleClose = () => {
    dispatch(closeModal('editDashboard'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    if (!dashboardId) {
      toast.error('No dashboard selected');
      return;
    }

    setIsSubmitting(true);
    try {
      await dispatch(
        updateDashboard({
          id: dashboardId,
          data: {
            name: formData.name.trim(),
            description: formData.description.trim(),
          },
        })
      ).unwrap();

      toast.success('Dashboard updated successfully!');
      handleClose();
    } catch (error) {
      toast.error('Failed to update dashboard');
      console.error('Error updating dashboard:', error);
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
      title="Edit Dashboard"
      description="Update the name and description of your dashboard."
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
