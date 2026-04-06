import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { closeModal } from '@/store/uiSlice';
import BaseModal from './BaseModal';
import { WidgetBlueprint, WidgetBlueprintField } from '@/types';
import { widgetBlueprintAPI } from '@/services/api';
import { PlusIcon, TrashIcon, EyeIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';

interface WidgetBuilderModalProps {
  isOpen: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', description: 'Single line text input' },
  { value: 'textarea', label: 'Textarea', description: 'Multi-line text input' },
  { value: 'rich_text', label: 'Rich Text', description: 'Markdown or formatted text' },
  { value: 'number', label: 'Number', description: 'Numeric input' },
  { value: 'checkbox', label: 'Checkbox', description: 'True/false toggle' },
  { value: 'select', label: 'Select', description: 'Dropdown menu' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'color', label: 'Color', description: 'Color picker' },
  { value: 'url', label: 'URL', description: 'URL input with validation' },
  { value: 'email', label: 'Email', description: 'Email input with validation' },
  { value: 'file', label: 'File', description: 'File upload' },
];

const LAYOUT_OPTIONS = [
  { value: 'list', label: 'List', description: 'Vertical list of items' },
  { value: 'table', label: 'Data Table', description: 'Structured table with custom fields' },
  {
    value: 'simple_table',
    label: 'Simple Table',
    description: 'Spreadsheet-style table with free editing',
  },
  { value: 'cards', label: 'Cards', description: 'Card-based grid layout' },
  { value: 'form', label: 'Form', description: 'Single form for data entry' },
  { value: 'note', label: 'Note', description: 'Simple note-taking' },
  { value: 'markdown', label: 'Markdown', description: 'Rich markdown editor' },
  { value: 'image', label: 'Image', description: 'Single image display' },
  { value: 'gallery', label: 'Gallery', description: 'Multiple images grid' },
];

const CATEGORIES = [
  'Productivity',
  'Notes',
  'Data',
  'Media',
  'Forms',
  'Education',
  'Communication',
];

export default function WidgetBuilderModal({ isOpen }: WidgetBuilderModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [currentStep, setCurrentStep] = useState<
    'basic' | 'fields' | 'layout' | 'settings' | 'preview'
  >('basic');

  // Widget blueprint state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Productivity');
  const [tags, setTags] = useState('');
  const [displayLayout, setDisplayLayout] = useState('list');
  const [fields, setFields] = useState<WidgetBlueprintField[]>([]);
  const [settings, setSettings] = useState({
    backgroundColor: '#ffffff',
    textColor: '#374151',
    fontSize: 14,
  });

  // Field editing state
  const [editingField, setEditingField] = useState<WidgetBlueprintField | null>(null);
  const [showFieldForm, setShowFieldForm] = useState(false);

  const resetForm = () => {
    setCurrentStep('basic');
    setName('');
    setDescription('');
    setCategory('Productivity');
    setTags('');
    setDisplayLayout('list');
    setFields([]);
    setSettings({
      backgroundColor: '#ffffff',
      textColor: '#374151',
      fontSize: 14,
    });
    setEditingField(null);
    setShowFieldForm(false);
  };

  const handleClose = () => {
    resetForm();
    dispatch(closeModal('widgetBuilder'));
  };

  const addField = () => {
    const newField: WidgetBlueprintField = {
      id: uuidv4(),
      name: '',
      type: 'text',
      required: false,
      placeholder: '',
      description: '',
    };
    setEditingField(newField);
    setShowFieldForm(true);
  };

  const editField = (field: WidgetBlueprintField) => {
    setEditingField({ ...field });
    setShowFieldForm(true);
  };

  const saveField = () => {
    if (!editingField || !editingField.name.trim()) return;

    // Clean up options for select fields by filtering out empty strings
    const cleanedField = {
      ...editingField,
      options:
        editingField.type === 'select' && editingField.options
          ? editingField.options.filter(opt => opt.trim().length > 0)
          : editingField.options,
    };

    const existingIndex = fields.findIndex(f => f.id === editingField.id);
    if (existingIndex >= 0) {
      const newFields = [...fields];
      newFields[existingIndex] = cleanedField;
      setFields(newFields);
    } else {
      setFields([...fields, cleanedField]);
    }

    setEditingField(null);
    setShowFieldForm(false);
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(f => f.id === fieldId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    const [movedField] = newFields.splice(currentIndex, 1);
    newFields.splice(newIndex, 0, movedField);
    setFields(newFields);
  };

  const generateBlueprint = () => {
    // Map display layout to Universal Widget System display component
    const getDisplayComponent = (layout: string) => {
      switch (layout) {
        case 'list':
          return 'List';
        case 'table':
          return 'Table';
        case 'simple_table':
          return 'Spreadsheet';
        case 'cards':
          return 'Cards';
        case 'form':
          return 'Form';
        case 'note':
          return 'Note';
        case 'markdown':
          return 'Markdown';
        case 'image':
          return 'Gallery';
        case 'gallery':
          return 'Gallery';
        case 'kanban':
          return 'Kanban';
        default:
          return 'List';
      }
    };

    // Convert legacy fields to Universal Widget System fields
    const universalFields = fields.map(field => ({
      id: field.id,
      name: field.name,
      type: field.type === 'rich_text' ? 'richtext' : field.type,
      required: field.required || false,
      defaultValue: field.defaultValue,
      options: field.options,
      placeholder: field.placeholder,
      description: field.description,
      validation: field.validation,
    }));

    // Create Universal Widget System v2.0 blueprint
    return {
      name,
      description,
      widget_version: '2.0', // Universal Widget System v2.0
      data_source: {
        type: 'userInput', // User manually enters data
      },
      data_schema: {
        fields: universalFields,
        primaryKey: universalFields.length > 0 ? universalFields[0].id : undefined,
      },
      view_schema: {
        displayComponent: getDisplayComponent(displayLayout),
        mappings: {
          // Default mappings - the display components will handle these appropriately
          data: 'data',
          schema: 'schema',
        },
        interactions: {
          allowAdd: true,
          allowEdit: true,
          allowDelete: true,
          allowSort: true,
          allowFilter: false,
          allowSearch: false,
        },
      },
      settings: {
        title: name,
        defaultWidth: 300,
        defaultHeight: 200,
        ...settings,
      },
      widget_metadata: {
        category,
        tags: tags
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0),
        author: 'Custom Widget Builder',
        version: '1.0',
        created_at: new Date().toISOString(),
      },
    };
  };

  const saveWidget = async () => {
    try {
      const blueprint = generateBlueprint();

      console.log('Saving Universal Widget System v2.0 blueprint:', blueprint);

      // Save to backend API with Universal Widget System v2.0 schema
      const response = await widgetBlueprintAPI.create({
        name: blueprint.name,
        description: blueprint.description,
        widget_version: blueprint.widget_version, // "2.0"
        data_source: blueprint.data_source, // Universal data source config
        data_schema: blueprint.data_schema, // Universal data schema
        view_schema: blueprint.view_schema, // Universal view schema
        settings: blueprint.settings,
        widget_metadata: blueprint.widget_metadata,
        is_public: true, // Make it public so it appears in the widget library
      });

      console.log('Universal Widget System blueprint saved successfully:', response.data);

      // Show success message
      // TODO: You could show a toast notification here

      handleClose();
    } catch (error) {
      console.error('Failed to save widget blueprint:', error);
      // TODO: You could show an error message to the user here
    }
  };

  const renderBasicStep = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Widget Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="My Custom Widget"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe what your widget does..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="productivity, task, personal"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated tags</p>
        </div>
      </div>
    </div>
  );

  const renderFieldsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Define Fields</h3>
        <button
          onClick={addField}
          className="flex items-center px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md hover:shadow-lg"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add Field
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No fields defined yet.</p>
          <p className="text-sm">Click "Add Field" to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center p-3 bg-gray-50 rounded-md">
              <div className="flex-1">
                <div className="font-medium">{field.name || 'Unnamed Field'}</div>
                <div className="text-sm text-gray-500">
                  {FIELD_TYPES.find(t => t.value === field.type)?.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => moveField(field.id, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveField(field.id, 'down')}
                  disabled={index === fields.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  ↓
                </button>
                <button
                  onClick={() => editField(field)}
                  className="p-1 text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteField(field.id)}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Edit Form */}
      {showFieldForm && editingField && (
        <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50">
          <h4 className="font-medium mb-3">
            {fields.find(f => f.id === editingField.id) ? 'Edit Field' : 'Add Field'}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingField.name}
                onChange={e => setEditingField({ ...editingField, name: e.target.value })}
                placeholder="Field name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
              <select
                value={editingField.type}
                onChange={e => setEditingField({ ...editingField, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
              <input
                type="text"
                value={editingField.placeholder || ''}
                onChange={e => setEditingField({ ...editingField, placeholder: e.target.value })}
                placeholder="Enter placeholder..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
              <input
                type="text"
                value={editingField.defaultValue || ''}
                onChange={e => setEditingField({ ...editingField, defaultValue: e.target.value })}
                placeholder="Default value..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {editingField.type === 'select' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options (one per line)
                </label>
                <textarea
                  value={(editingField.options || []).join('\n')}
                  onChange={e =>
                    setEditingField({
                      ...editingField,
                      options: e.target.value.split('\n'),
                    })
                  }
                  onKeyDown={e => {
                    // Allow Enter key to create new lines
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                    }
                  }}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={editingField.description || ''}
                onChange={e => setEditingField({ ...editingField, description: e.target.value })}
                placeholder="Help text for this field..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={editingField.required || false}
                  onChange={e => setEditingField({ ...editingField, required: e.target.checked })}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span className="text-sm text-gray-700">Required field</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => {
                setShowFieldForm(false);
                setEditingField(null);
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveField}
              disabled={!editingField.name.trim()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md hover:shadow-lg disabled:opacity-50"
            >
              {fields.find(f => f.id === editingField.id) ? 'Update' : 'Add'} Field
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderLayoutStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Choose Layout</h3>

      <div className="grid grid-cols-2 gap-4">
        {LAYOUT_OPTIONS.map(layout => (
          <div
            key={layout.value}
            onClick={() => setDisplayLayout(layout.value)}
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              displayLayout === layout.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="font-medium">{layout.label}</div>
            <div className="text-sm text-gray-500 mt-1">{layout.description}</div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> The layout determines how your data will be displayed. Choose the
          one that best fits your widget's purpose.
        </p>
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Widget Settings</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
          <input
            type="color"
            value={settings.backgroundColor}
            onChange={e => setSettings({ ...settings, backgroundColor: e.target.value })}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
          <input
            type="color"
            value={settings.textColor}
            onChange={e => setSettings({ ...settings, textColor: e.target.value })}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
          <input
            type="range"
            min="10"
            max="24"
            value={settings.fontSize}
            onChange={e => setSettings({ ...settings, fontSize: Number(e.target.value) })}
            className="w-full"
          />
          <div className="text-sm text-gray-500">{settings.fontSize}px</div>
        </div>
      </div>

      {/* Preview */}
      <div
        className="mt-6 p-4 border rounded-md"
        style={{
          backgroundColor: settings.backgroundColor,
          color: settings.textColor,
          fontSize: `${settings.fontSize}px`,
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        <div className="font-medium mb-2">{name || 'Widget Name'}</div>
        <div className="text-sm opacity-75">This is how your widget text will look.</div>
        {fields.length > 0 && (
          <div className="mt-2 text-sm">Fields: {fields.map(f => f.name).join(', ')}</div>
        )}
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    const blueprint = generateBlueprint();

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Preview & Summary</h3>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">{blueprint.name}</h4>
          <p className="text-sm text-gray-600 mb-3">{blueprint.description}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Display:</span> {blueprint.view_schema.displayComponent}
            </div>
            <div>
              <span className="font-medium">Version:</span> Universal Widget System v
              {blueprint.widget_version}
            </div>
            <div>
              <span className="font-medium">Fields:</span> {fields.length}
            </div>
            <div>
              <span className="font-medium">Category:</span> {blueprint.widget_metadata?.category}
            </div>
          </div>

          {fields.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2">Fields:</div>
              <div className="space-y-1">
                {fields.map(field => (
                  <div key={field.id} className="text-sm flex items-center">
                    <span className="font-medium w-24">{field.name}</span>
                    <span className="text-gray-500 ml-2">
                      {FIELD_TYPES.find(t => t.value === field.type)?.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Ready to create!</strong> Your Universal Widget System v2.0 widget will be
            available in the Widget Library once created. This widget supports dynamic data handling
            and flexible display options.
          </p>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return renderBasicStep();
      case 'fields':
        return renderFieldsStep();
      case 'layout':
        return renderLayoutStep();
      case 'settings':
        return renderSettingsStep();
      case 'preview':
        return renderPreviewStep();
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 'basic':
        return name.trim().length > 0;
      case 'fields':
        return !showFieldForm;
      case 'layout':
        return displayLayout.length > 0;
      case 'settings':
        return true;
      case 'preview':
        return true;
      default:
        return false;
    }
  };

  const steps = ['basic', 'fields', 'layout', 'settings', 'preview'] as const;
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Widget Builder"
      size="3xl"
      description="This is a very basic widget builder to demonstrate the whole widget system and architecture. We will be adding more features and improvements to this in the future."
    >
      <div className="flex flex-col h-[80vh] min-h-[700px]">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-4 py-2 bg-gray-50 rounded-lg">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex items-center ${
                index <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStepIndex
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-1 ml-2 ${
                    index < currentStepIndex
                      ? 'bg-violet-600'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto">{renderStepContent()}</div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4 border-t">
          <button
            onClick={() => {
              const prevIndex = Math.max(0, currentStepIndex - 1);
              setCurrentStep(steps[prevIndex]);
            }}
            disabled={currentStepIndex === 0}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>

          <div className="text-sm text-gray-500">
            Step {currentStepIndex + 1} of {steps.length}
          </div>

          {currentStep === 'preview' ? (
            <button
              onClick={saveWidget}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Create Widget
            </button>
          ) : (
            <button
              onClick={() => {
                const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
                setCurrentStep(steps[nextIndex]);
              }}
              disabled={!canGoNext()}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md hover:shadow-lg disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}
