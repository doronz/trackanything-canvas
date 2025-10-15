/**
 * FormDisplay - Universal Widget System Display Component
 * Renders data as an interactive form for data input/editing
 */

import React, { useState, useEffect } from 'react';
import { UniversalWidgetBlueprint, UniversalField } from '@/types/universalWidget';
import { PluggableWidget } from '@/types';

interface FormDisplayProps {
  widget: PluggableWidget;
  blueprint: UniversalWidgetBlueprint;
  data: any[];
  isSelected: boolean;
  styleProps: any;
  onDataChange: (newData: any) => void;
  onRefresh: () => void;
}

export default function FormDisplay({
  widget,
  blueprint,
  data,
  isSelected,
  styleProps,
  onDataChange,
  onRefresh,
}: FormDisplayProps) {
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with existing data or defaults
  useEffect(() => {
    const initialData: any = {};

    // Use first item from data array, or empty object
    const existingData = Array.isArray(data) && data.length > 0 ? data[0] : {};

    blueprint.dataSchema.fields.forEach(field => {
      initialData[field.id] =
        existingData[field.id] || field.defaultValue || getDefaultValueForType(field.type);
    });

    setFormData(initialData);
  }, [data, blueprint.dataSchema.fields]);

  // Get default value based on field type
  const getDefaultValueForType = (type: string) => {
    switch (type) {
      case 'boolean':
        return false;
      case 'number':
        return 0;
      case 'multiselect':
        return [];
      case 'date':
      case 'datetime':
        return '';
      default:
        return '';
    }
  };

  // Handle form field change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value,
    }));

    // Clear field error on change
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    blueprint.dataSchema.fields.forEach(field => {
      const value = formData[field.id];

      // Required validation
      if (field.required && (value === '' || value === null || value === undefined)) {
        newErrors[field.id] = `${field.name} is required`;
        return;
      }

      // Skip further validation if empty and not required
      if (value === '' || value === null || value === undefined) return;

      // Type-specific validation
      if (field.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          newErrors[field.id] = 'Please enter a valid email address';
        }
      }

      if (field.type === 'url') {
        try {
          new URL(String(value));
        } catch {
          newErrors[field.id] = 'Please enter a valid URL';
        }
      }

      if (field.type === 'number') {
        if (isNaN(Number(value))) {
          newErrors[field.id] = 'Please enter a valid number';
        }
      }

      // Validation rules
      if (field.validation) {
        const validation = field.validation;

        if (field.type === 'number' && typeof value === 'number') {
          if (validation.min !== undefined && value < validation.min) {
            newErrors[field.id] = `Must be at least ${validation.min}`;
          }
          if (validation.max !== undefined && value > validation.max) {
            newErrors[field.id] = `Must be at most ${validation.max}`;
          }
        }

        if (typeof value === 'string') {
          if (validation.min !== undefined && value.length < validation.min) {
            newErrors[field.id] = `Must be at least ${validation.min} characters`;
          }
          if (validation.max !== undefined && value.length > validation.max) {
            newErrors[field.id] = `Must be at most ${validation.max} characters`;
          }

          if (validation.pattern) {
            const pattern = new RegExp(validation.pattern);
            if (!pattern.test(value)) {
              newErrors[field.id] = validation.message || 'Invalid format';
            }
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Add/update data
      const newItem = {
        id: Date.now().toString(), // Simple ID generation
        ...formData,
      };

      const newData = Array.isArray(data) ? [...data, newItem] : [newItem];
      onDataChange(newData);

      // Reset form if it's an add form
      if (blueprint.viewSchema.interactions?.allowAdd) {
        const resetData: any = {};
        blueprint.dataSchema.fields.forEach(field => {
          resetData[field.id] = field.defaultValue || getDefaultValueForType(field.type);
        });
        setFormData(resetData);
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render field based on type
  const renderField = (field: UniversalField) => {
    const value = formData[field.id] || '';
    const error = errors[field.id];

    const baseClasses = `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      error ? 'border-red-500' : 'border-gray-300'
    }`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        return (
          <input
            type={field.type}
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseClasses}
            required={field.required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={e => handleFieldChange(field.id, Number(e.target.value))}
            placeholder={field.placeholder}
            className={baseClasses}
            required={field.required}
            min={field.validation?.min}
            max={field.validation?.max}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={`${baseClasses} min-h-[100px] resize-vertical`}
            required={field.required}
            rows={3}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={e => handleFieldChange(field.id, e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm">{field.name}</span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className={baseClasses}
            required={field.required}
          >
            <option value="">Select {field.name}</option>
            {field.options?.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
            {field.options?.map(option => (
              <label key={option} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={e => {
                    const currentArray = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      handleFieldChange(field.id, [...currentArray, option]);
                    } else {
                      handleFieldChange(
                        field.id,
                        currentArray.filter(v => v !== option)
                      );
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className={baseClasses}
            required={field.required}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className={baseClasses}
            required={field.required}
          />
        );

      case 'color':
        return (
          <input
            type="color"
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
            required={field.required}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseClasses}
            required={field.required}
          />
        );
    }
  };

  const interactions = blueprint.viewSchema.interactions || {};

  return (
    <div
      className="w-full h-full p-4 overflow-auto"
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: `${styleProps?.fontSize || 14}px`,
        color: styleProps?.textColor || '#374151',
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {blueprint.dataSchema.fields.map(field => (
          <div key={field.id} className="space-y-1">
            {/* Field Label */}
            {field.type !== 'boolean' && (
              <label className="block text-sm font-medium text-gray-700">
                {field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}

            {/* Field Input */}
            {renderField(field)}

            {/* Field Description */}
            {field.description && <p className="text-xs text-gray-500">{field.description}</p>}

            {/* Field Error */}
            {errors[field.id] && <p className="text-xs text-red-600">{errors[field.id]}</p>}
          </div>
        ))}

        {/* Submit Button */}
        {(interactions.allowAdd || interactions.allowEdit) && (
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        )}

        {/* Existing Data Preview */}
        {Array.isArray(data) && data.length > 0 && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Submitted Data ({data.length} items)
            </h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {data.slice(-5).map((item, index) => (
                <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                  {JSON.stringify(item, null, 2)}
                </div>
              ))}
              {data.length > 5 && (
                <div className="text-xs text-gray-500 text-center">
                  ... and {data.length - 5} more items
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
