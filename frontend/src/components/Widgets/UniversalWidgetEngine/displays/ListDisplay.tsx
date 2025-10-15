/**
 * ListDisplay - Universal Widget System Display Component
 * Renders data in a simple list format with inline editing
 */

import React, { useState } from 'react';
import { UniversalWidgetBlueprint } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';
import { PencilIcon, TrashIcon, PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

interface ListDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

export default function ListDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: ListDisplayProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemData, setNewItemData] = useState<any>({});

  // Extract mappings from view schema
  const mappings = blueprint.viewSchema.mappings;
  const listItemField =
    mappings.listItem?.replace('data.', '') || blueprint.dataSchema.fields[0]?.id || 'title';
  const listSubtitleField = mappings.listSubtitle?.replace('data.', '');
  const listMetaField = mappings.listMeta?.replace('data.', '');

  const interactions = blueprint.viewSchema.interactions || {};

  // Handle delete
  const handleDelete = (item: any) => {
    if (!interactions.allowDelete) return;

    const newData = data.filter(d => d !== item);
    onDataChange({ data: newData });
  };

  // Start editing an item
  const handleStartEdit = (item: any, index: number) => {
    if (!interactions.allowEdit) return;
    setEditingIndex(index);
    setEditingItem({ ...item });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  // Save edited item
  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const newData = [...data];
    newData[editingIndex] = editingItem;
    onDataChange({ data: newData });
    setEditingIndex(null);
    setEditingItem(null);
  };

  // Show add form
  const handleShowAddForm = () => {
    if (!interactions.allowAdd) return;

    // Initialize with default values
    const initialData: any = {
      id: Date.now().toString(),
    };

    blueprint.dataSchema.fields.forEach(field => {
      initialData[field.id] = field.defaultValue || '';
    });

    setNewItemData(initialData);
    setShowAddForm(true);
  };

  // Cancel add
  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewItemData({});
  };

  // Save new item
  const handleSaveAdd = () => {
    const newData = [...(data || []), newItemData];
    onDataChange({ data: newData });
    setShowAddForm(false);
    setNewItemData({});
  };

  // Update field value for editing
  const handleFieldChange = (fieldId: string, value: any, isEditing: boolean = false) => {
    if (isEditing) {
      setEditingItem({ ...editingItem, [fieldId]: value });
    } else {
      setNewItemData({ ...newItemData, [fieldId]: value });
    }
  };

  // Render form field based on field type
  const renderFormField = (field: any, value: any, isEditing: boolean = false) => {
    const fieldValue = value || '';

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={fieldValue}
            onChange={e => handleFieldChange(field.id, e.target.value, isEditing)}
            placeholder={field.placeholder || field.name}
            required={field.required}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={fieldValue}
            onChange={e => handleFieldChange(field.id, parseFloat(e.target.value), isEditing)}
            placeholder={field.placeholder || field.name}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={!!fieldValue}
            onChange={e => handleFieldChange(field.id, e.target.checked, isEditing)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        );
      case 'select':
        return (
          <select
            value={fieldValue}
            onChange={e => handleFieldChange(field.id, e.target.value, isEditing)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Select {field.name}</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={fieldValue}
            onChange={e => handleFieldChange(field.id, e.target.value, isEditing)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        );
      default:
        return (
          <input
            type="text"
            value={fieldValue}
            onChange={e => handleFieldChange(field.id, e.target.value, isEditing)}
            placeholder={field.placeholder || field.name}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        );
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-medium text-gray-900">
          {blueprint.settings.title || blueprint.name}
          <span className="ml-2 text-sm text-gray-500">({data?.length || 0} items)</span>
        </h3>

        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
          >
            Refresh
          </button>

          {interactions.allowAdd && (
            <button
              onClick={handleShowAddForm}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <h4 className="font-medium text-gray-900 mb-3">Add New Item</h4>
          <div className="space-y-3">
            {blueprint.dataSchema.fields.map(field => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.name}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderFormField(field, newItemData[field.id], false)}
                {field.description && (
                  <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSaveAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
            >
              <CheckIcon className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancelAdd}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto">
        {data && data.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <li
                key={item.id || index}
                className={`p-4 hover:bg-gray-50 group ${editingIndex === index ? 'bg-yellow-50' : ''}`}
              >
                {editingIndex === index ? (
                  // Edit Mode
                  <div className="space-y-3">
                    {blueprint.dataSchema.fields.map(field => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.name}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {renderFormField(field, editingItem[field.id], true)}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center gap-1"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm flex items-center gap-1"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* Main content */}
                      <div className="font-medium text-gray-900">
                        {item[listItemField] || 'Untitled'}
                      </div>

                      {/* Subtitle */}
                      {listSubtitleField && item[listSubtitleField] && (
                        <div className="text-sm text-gray-600 mt-1">{item[listSubtitleField]}</div>
                      )}

                      {/* Meta */}
                      {listMetaField && item[listMetaField] && (
                        <div className="text-xs text-gray-500 mt-1">{item[listMetaField]}</div>
                      )}

                      {/* Show additional fields if no specific mappings */}
                      {!listSubtitleField && !listMetaField && (
                        <div className="mt-2 space-y-1">
                          {blueprint.dataSchema.fields.slice(1, 3).map(
                            field =>
                              item[field.id] && (
                                <div key={field.id} className="text-sm text-gray-600">
                                  <span className="font-medium">{field.name}:</span>{' '}
                                  {item[field.id]}
                                </div>
                              )
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {interactions.allowEdit && (
                        <button
                          onClick={() => handleStartEdit(item, index)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                          title="Edit item"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      )}
                      {interactions.allowDelete && (
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                          title="Delete item"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📝</div>
              <div className="text-lg font-medium">No items yet</div>
              <div className="text-sm mt-1">
                {interactions.allowAdd ? (
                  <button onClick={handleShowAddForm} className="text-blue-600 hover:underline">
                    Add your first item
                  </button>
                ) : (
                  'No data available'
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
