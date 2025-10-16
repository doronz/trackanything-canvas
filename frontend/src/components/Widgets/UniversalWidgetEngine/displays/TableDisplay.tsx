/**
 * TableDisplay - Universal Widget System Display Component
 * Renders data in a table format with sorting, filtering, and pagination
 */

import { PluggableWidget } from '@/types';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { useMemo, useState } from 'react';

interface TableDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

export default function TableDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: TableDisplayProps) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<any>({});
  const [newItemBeingCreated, setNewItemBeingCreated] = useState<any | null>(null);

  const interactions = blueprint.viewSchema.interactions || {};
  const pagination = blueprint.viewSchema.pagination || {};
  const pageSize = pagination.pageSize || 10;

  // Filter and sort data
  const processedData = useMemo(() => {
    // Ensure data is always an array to prevent slice() errors
    let filtered = Array.isArray(data) ? data : [];

    // Add new item being created to the display data
    if (newItemBeingCreated) {
      filtered = [...filtered, newItemBeingCreated];
    }

    // Apply filter
    if (filterText && interactions.allowFilter) {
      filtered = filtered.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(filterText.toLowerCase())
        )
      );
    }

    // Apply sort
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === bValue) return 0;

        let comparison = 0;
        if (aValue > bValue) comparison = 1;
        if (aValue < bValue) comparison = -1;

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, filterText, sortField, sortDirection, interactions.allowFilter, newItemBeingCreated]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination.enabled) return processedData;

    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize, pagination.enabled]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  // Handle sort
  const handleSort = (fieldId: string) => {
    if (!interactions.allowSort) return;

    if (sortField === fieldId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(fieldId);
      setSortDirection('asc');
    }
  };

  // Handle delete
  const handleDelete = (item: any) => {
    if (!interactions.allowDelete) return;

    const newData = data.filter(d => d !== item);
    onDataChange({ data: newData });
  };

  // Handle add new
  const handleAdd = () => {
    if (!interactions.allowAdd) return;

    const newItemId = Date.now().toString();
    const newItem: any = {
      id: newItemId,
    };

    // Add default values
    blueprint.dataSchema.fields.forEach(field => {
      newItem[field.id] = field.defaultValue || '';
    });

    // Don't add to data immediately - keep in separate state until saved
    setNewItemBeingCreated(newItem);
    setEditingItemId(newItemId);
    setEditingValues(newItem);
  };

  // Handle edit
  const handleEdit = (item: any) => {
    if (!interactions.allowEdit) return;
    setEditingItemId(item.id);
    setEditingValues({ ...item });
  };

  // Handle save
  const handleSave = () => {
    if (!editingItemId) return;

    if (newItemBeingCreated && newItemBeingCreated.id === editingItemId) {
      // This is a new item - add it to the data
      const newData = [...(data || []), { ...editingValues }];
      onDataChange({ data: newData });
      setNewItemBeingCreated(null);
    } else {
      // This is an existing item - update it
      const newData = data.map(item => (item.id === editingItemId ? { ...editingValues } : item));
      onDataChange({ data: newData });
    }

    setEditingItemId(null);
    setEditingValues({});
  };

  // Handle cancel
  const handleCancel = () => {
    if (!editingItemId) return;

    if (newItemBeingCreated && newItemBeingCreated.id === editingItemId) {
      // This was a new item that hasn't been saved yet - just clear it
      setNewItemBeingCreated(null);
    }

    setEditingItemId(null);
    setEditingValues({});
  };

  // Handle field value change
  const handleFieldChange = (fieldId: string, value: any) => {
    setEditingValues((prev: Record<string, any>) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Render editable cell
  const renderEditableCell = (field: any, value: any) => {
    const commonClasses =
      'w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

    switch (field.type) {
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className={commonClasses}
          >
            <option value="">Select...</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={e => handleFieldChange(field.id, e.target.checked)}
            className="w-4 h-4"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className={commonClasses}
          />
        );
      case 'email':
        return (
          <input
            type="email"
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        );
      case 'url':
        return (
          <input
            type="url"
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        );
      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
            rows={2}
          />
        );
      default: // text and others
        return (
          <input
            type="text"
            value={value || ''}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={commonClasses}
          />
        );
    }
  };

  // Format cell value
  const formatCellValue = (value: any, fieldType: string) => {
    if (value === null || value === undefined) return '-';

    switch (fieldType) {
      case 'boolean':
        return value ? '✓' : '✗';
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'datetime':
        return new Date(value).toLocaleString();
      case 'multiselect':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'url':
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {value}
          </a>
        );
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
            {value}
          </a>
        );
      default:
        return String(value);
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-gray-800"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
      }}
    >
      {/* Header Controls */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {/* Search */}
          {interactions.allowSearch && (
            <input
              type="text"
              placeholder="Search..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          )}

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md text-sm"
          >
            Refresh
          </button>
        </div>

        {/* Add New */}
        {interactions.allowAdd && (
          <button
            onClick={handleAdd}
            className="px-3 py-1 bg-blue-500 dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-md text-sm"
          >
            Add New
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              {blueprint.dataSchema.fields.map(field => (
                <th
                  key={field.id}
                  className={`px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 ${
                    interactions.allowSort ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''
                  }`}
                  onClick={() => handleSort(field.id)}
                >
                  <div className="flex items-center gap-2">
                    {field.name}
                    {interactions.allowSort && sortField === field.id && (
                      <span className="text-gray-500 dark:text-gray-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
              {(interactions.allowEdit || interactions.allowDelete) && (
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => {
              const isEditing = editingItemId === item.id;
              return (
                <tr
                  key={item.id || index}
                  className={`border-b border-gray-200 dark:border-gray-700 ${isEditing ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                  {blueprint.dataSchema.fields.map(field => (
                    <td key={field.id} className="px-4 py-3 text-gray-900 dark:text-white">
                      {isEditing
                        ? renderEditableCell(field, editingValues[field.id])
                        : formatCellValue(item[field.id], field.type)}
                    </td>
                  ))}
                  {(interactions.allowEdit || interactions.allowDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSave}
                              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-xs font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {interactions.allowEdit && (
                              <button
                                onClick={() => handleEdit(item)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs"
                              >
                                Edit
                              </button>
                            )}
                            {interactions.allowDelete && (
                              <button
                                onClick={() => handleDelete(item)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {paginatedData.length === 0 && (
              <tr>
                <td
                  colSpan={
                    blueprint.dataSchema.fields.length +
                    (interactions.allowEdit || interactions.allowDelete ? 1 : 0)
                  }
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  No data available
                  {filterText && (
                    <div className="text-xs mt-1">
                      Try adjusting your search or{' '}
                      <button
                        onClick={() => setFilterText('')}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        clear filter
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.enabled && totalPages > 1 && (
        <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length}{' '}
            results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-900 dark:text-white">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
