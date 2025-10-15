import { AppDispatch, RootState } from '@/store';
import {
  createAIConfig,
  deleteAIConfig,
  fetchAIConfigs,
  fetchProviderModels,
  fetchSupportedProviders,
  setDefaultAIConfig,
  testAIConfig,
  updateAIConfig,
} from '@/store/aiConfigSlice';
import { closeModal } from '@/store/uiSlice';
import {
  CheckCircleIcon,
  CpuChipIcon,
  EyeIcon,
  EyeSlashIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import BaseModal from './BaseModal';

// Provider icon URLs
const PROVIDER_ICONS: Record<string, string> = {
  openai: 'https://openai.com/favicon.ico',
  anthropic: 'https://claude.ai/images/claude_app_icon.png',
  gemini: 'https://www.gstatic.com/lamda/images/gemini_sparkle_4g_512_lt_f94943af3be039176192d.png',
  ollama: 'https://ollama.com/public/ollama.png',
};

// Provider icon component with fallback
function ProviderIcon({
  provider,
  className = 'w-5 h-5',
}: {
  provider: string;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);
  const iconUrl = PROVIDER_ICONS[provider?.toLowerCase()] || null;

  if (!iconUrl || imageError) {
    return <CpuChipIcon className={className} />;
  }

  return (
    <img
      src={iconUrl}
      alt={`${provider} icon`}
      className={className}
      onError={() => setImageError(true)}
    />
  );
}

interface AIConfigModalProps {
  isOpen: boolean;
}

export default function AIConfigModal({ isOpen }: AIConfigModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { configs, loading, defaultConfig, testing } = useSelector(
    (state: RootState) => state.aiConfig
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<number | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [supportedProviders, setSupportedProviders] = useState<Record<string, any>>({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai' as 'openai' | 'anthropic' | 'ollama' | 'gemini' | 'custom',
    model: '',
    api_key: '',
    api_endpoint: '',
    parameters: {
      temperature: 0.7,
      max_tokens: 1000,
    },
    is_default: false,
  });

  // Load configs and providers when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAIConfigs());
      dispatch(fetchSupportedProviders()).then(result => {
        if (result.payload) {
          setSupportedProviders(result.payload);
        }
      });
    }
  }, [isOpen, dispatch]);

  const handleClose = () => {
    dispatch(closeModal('aiConfig'));
    setShowAddForm(false);
    setEditingConfig(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'openai',
      model: '',
      api_key: '',
      api_endpoint: '',
      parameters: {
        temperature: 0.7,
        max_tokens: 1000,
      },
      is_default: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ollama doesn't require API key, but other providers do
    const requiresApiKey = formData.provider !== 'ollama';
    if (
      !formData.name.trim() ||
      !formData.model.trim() ||
      (requiresApiKey && !formData.api_key.trim())
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingConfig) {
        await dispatch(
          updateAIConfig({
            id: editingConfig,
            data: {
              name: formData.name.trim(),
              provider: formData.provider,
              model: formData.model.trim(),
              api_key: formData.api_key.trim(),
              api_endpoint: formData.api_endpoint.trim() || undefined,
              parameters: formData.parameters,
              is_default: formData.is_default,
            },
          })
        ).unwrap();
        toast.success('AI configuration updated successfully');
        setEditingConfig(null);
      } else {
        await dispatch(
          createAIConfig({
            name: formData.name.trim(),
            provider: formData.provider,
            model: formData.model.trim(),
            api_key: formData.api_key.trim(),
            api_endpoint: formData.api_endpoint.trim() || undefined,
            parameters: formData.parameters,
            is_default: formData.is_default,
          })
        ).unwrap();
        toast.success('AI configuration created successfully');
      }

      setShowAddForm(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save AI configuration');
    }
  };

  const handleEdit = (config: any) => {
    setFormData({
      name: config.name,
      provider: config.provider,
      model: config.model,
      api_key: '', // Don't show existing API key for security
      api_endpoint: config.api_endpoint || '',
      parameters: config.parameters || { temperature: 0.7, max_tokens: 1000 },
      is_default: config.is_default,
    });
    setEditingConfig(config.id);
    setShowAddForm(true);
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('Are you sure you want to delete this AI configuration?')) {
      return;
    }

    try {
      await dispatch(deleteAIConfig(configId)).unwrap();
      toast.success('AI configuration deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete AI configuration');
    }
  };

  const handleTest = async (configId: number) => {
    try {
      await dispatch(testAIConfig(configId)).unwrap();
      toast.success('AI configuration test successful!');
    } catch (error: any) {
      toast.error(error.message || 'AI configuration test failed');
    }
  };

  const handleSetDefault = async (configId: number) => {
    try {
      await dispatch(setDefaultAIConfig(configId)).unwrap();
      toast.success('Default AI configuration updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to set default configuration');
    }
  };

  const toggleApiKeyVisibility = (configId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [configId]: !prev[configId],
    }));
  };

  const getStatusIcon = (config: any) => {
    // For Ollama, we don't need an API key, so consider it connected if it has an endpoint
    if (config.provider?.toLowerCase() === 'ollama') {
      return config.api_endpoint ? (
        <CheckCircleIcon className="w-5 h-5 text-green-500" />
      ) : (
        <XCircleIcon className="w-5 h-5 text-red-500" />
      );
    }
    // For other providers, check if API key is set
    if (config.has_api_key) {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
    return <XCircleIcon className="w-5 h-5 text-red-500" />;
  };

  const getProviderModels = (provider: string) => {
    return supportedProviders[provider]?.models || [];
  };

  const handleApiKeyBlur = async () => {
    // Don't fetch if no API key is provided, or if it's Ollama (doesn't need API key)
    if (!formData.api_key.trim() || formData.provider === 'ollama') {
      return;
    }

    // Fetch models with the provided API key
    setFetchingModels(true);
    try {
      const result = await dispatch(
        fetchProviderModels({
          provider: formData.provider,
          apiKey: formData.api_key.trim(),
          apiEndpoint: formData.api_endpoint || undefined,
        })
      ).unwrap();

      // Update the supported providers with the fetched models
      setSupportedProviders(prev => ({
        ...prev,
        [formData.provider]: {
          ...prev[formData.provider],
          models: result.models,
        },
      }));

      toast.success(`Fetched ${result.count} models for ${formData.provider}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch models. Using default list.');
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={handleClose} title="AI Configuration" size="lg">
      <div className="space-y-6">
        {!showAddForm ? (
          <>
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CpuChipIcon className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    AI Configurations
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage your AI provider configurations and API keys
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Configuration</span>
              </button>
            </div>

            {/* Configurations List */}
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Loading configurations...
                  </p>
                </div>
              ) : configs.length === 0 ? (
                <div className="text-center py-8">
                  <CpuChipIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No AI Configurations
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Add your first AI configuration to start using AI chat features.
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Add Configuration</span>
                  </button>
                </div>
              ) : (
                configs.map(config => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <ProviderIcon provider={config.provider} />
                      {getStatusIcon(config)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {config.name}
                          </h4>
                          {config.is_default && (
                            <StarIconSolid
                              className="w-4 h-4 text-yellow-500"
                              title="Default Configuration"
                            />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {config.provider} • {config.model} •{' '}
                          {config.provider?.toLowerCase() === 'ollama'
                            ? config.api_endpoint
                              ? 'Endpoint Set'
                              : 'No Endpoint'
                            : config.has_api_key
                              ? 'API Key Set'
                              : 'No API Key'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!config.is_default && (
                        <button
                          onClick={() => handleSetDefault(config.id)}
                          className="p-2 text-gray-400 hover:text-yellow-500 transition-colors"
                          title="Set as Default"
                        >
                          <StarIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleTest(config.id)}
                        disabled={testing[config.id] || !config.has_api_key}
                        className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 disabled:opacity-50"
                      >
                        {testing[config.id] ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => handleEdit(config)}
                        className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 dark:bg-green-900 dark:text-green-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete Configuration"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Add/Edit Form */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <SparklesIcon className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {editingConfig ? 'Edit AI Configuration' : 'Add AI Configuration'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure your AI provider settings and API credentials
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingConfig(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Configuration Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Configuration Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., My OpenAI Config"
                  required
                />
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AI Provider *
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <ProviderIcon provider={formData.provider} className="w-5 h-5" />
                  </div>
                  <select
                    value={formData.provider}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        provider: e.target.value as any,
                        model: '', // Reset model when provider changes
                        api_endpoint:
                          e.target.value === 'ollama'
                            ? 'http://host.docker.internal:11434'
                            : e.target.value === 'gemini'
                              ? 'https://generativelanguage.googleapis.com/v1beta'
                              : e.target.value === 'custom'
                                ? prev.api_endpoint
                                : supportedProviders[e.target.value]?.endpoint || '',
                      }))
                    }
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  >
                    {Object.entries(supportedProviders).map(([key, provider]) => (
                      <option key={key} value={key}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key {formData.provider === 'ollama' ? '(Optional for Ollama)' : '*'}
                </label>
                {formData.provider === 'ollama' ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Ollama doesn't require an API key - it runs locally
                  </p>
                ) : (
                  <p className="text-sm text-blue-600 dark:text-blue-400 mb-2 flex items-center">
                    <SparklesIcon className="w-4 h-4 mr-1" />
                    Enter your API key to see available models for this provider
                  </p>
                )}
                <div className="relative">
                  <input
                    type={showApiKey['form'] ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    onBlur={handleApiKeyBlur}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder={
                      formData.provider === 'ollama'
                        ? 'No API key needed for Ollama'
                        : editingConfig
                          ? 'Leave empty to keep existing key'
                          : 'Enter your API key'
                    }
                    required={!editingConfig && formData.provider !== 'ollama'}
                    disabled={formData.provider === 'ollama'}
                  />
                  {formData.provider !== 'ollama' && (
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility('form')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showApiKey['form'] ? (
                        <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <EyeIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model *{' '}
                  {fetchingModels && (
                    <span className="text-sm text-blue-600">(Fetching models...)</span>
                  )}
                </label>
                {formData.provider === 'custom' ? (
                  <input
                    type="text"
                    value={formData.model}
                    onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter custom model name"
                    required
                  />
                ) : (
                  <>
                    <select
                      value={formData.model}
                      onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      required
                      disabled={fetchingModels}
                    >
                      <option value="">Select a model</option>
                      {getProviderModels(formData.provider).map((model: string) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    {formData.provider !== 'ollama' &&
                      getProviderModels(formData.provider).length > 0 &&
                      !formData.api_key && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Showing default models. Enter your API key above to fetch your available
                          models.
                        </p>
                      )}
                  </>
                )}
              </div>

              {/* API Endpoint (for Ollama and custom providers) */}
              {(formData.provider === 'custom' || formData.provider === 'ollama') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Endpoint {formData.provider === 'ollama' ? '*' : ''}
                  </label>
                  {formData.provider === 'ollama' && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Default Ollama endpoint for Docker. Use http://localhost:11434 if running
                      outside Docker.
                    </p>
                  )}
                  <input
                    type="url"
                    value={formData.api_endpoint}
                    onChange={e => setFormData(prev => ({ ...prev, api_endpoint: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    placeholder={
                      formData.provider === 'ollama'
                        ? 'http://host.docker.internal:11434'
                        : 'https://api.example.com/v1'
                    }
                    required={formData.provider === 'ollama'}
                  />
                </div>
              )}

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Temperature
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.parameters.temperature}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        parameters: {
                          ...prev.parameters,
                          temperature: parseFloat(e.target.value) || 0.7,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4000"
                    value={formData.parameters.max_tokens}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        parameters: {
                          ...prev.parameters,
                          max_tokens: parseInt(e.target.value) || 1000,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              {/* Set as Default */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={e => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="is_default"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Set as default configuration
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingConfig(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? 'Saving...'
                    : editingConfig
                      ? 'Update Configuration'
                      : 'Create Configuration'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </BaseModal>
  );
}
