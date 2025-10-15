export interface McpServerModalProps {
  isOpen: boolean;
}

export interface DirectoryServer {
  id: number;
  name: string;
  github_url: string;
  short_description: string;
  category: string;
  tags: string[];
  programming_language: string;
  transport_types: string[];
  full_description: string;
  instructions: string;
  installation_commands: string[];
  configuration_example: Record<string, any>;
  required_env_vars: string[];
  optional_env_vars: string[];
  tools_provided: string[];
  resources_provided: string[];
  stars: number;
  last_updated: string;
  is_official: boolean;
  is_verified: boolean;
}

export interface DirectoryStats {
  total_servers: number;
  categories: Array<{ name: string; count: number }>;
  programming_languages: Array<{ name: string; count: number }>;
  popular_tags: Array<{ name: string; count: number }>;
  last_updated: string;
}

export interface RegistryServer {
  id: number;
  registry_id: string;
  name: string;
  description: string;
  version: string;
  repository_url: string;
  homepage_url: string;
  documentation_url: string;
  package_name: string;
  package_manager: string;
  installation_command: string;
  schema_version: string;
  transport_types: string[];
  capabilities: string[];
  category: string;
  tags: string[];
  author: string;
  license: string;
  download_count: number;
  trust_score: number;
  verification_status: string;
  is_official: boolean;
  readme_content: string;
  example_usage: Array<{ name: string; config: Record<string, any> }>;
  registry_created_at: string;
  registry_updated_at: string;
  last_synced: string;
}

export interface RegistryStats {
  total_servers: number;
  official_servers: number;
  verified_servers: number;
  categories: Array<{ name: string; count: number }>;
  top_tags: Array<{ name: string; count: number }>;
}

export interface ServerFormData {
  name: string;
  url: string;
  type: 'local' | 'remote';
  command: string;
  args: string;
  env: string;
}

export interface DirectoryFilters {
  category: string;
  programming_language: string;
  tags: string;
  is_official: boolean;
  min_stars: number;
  server_type: string;
}

export interface RegistryFilters {
  category: string;
  is_official: boolean | undefined;
  verified_only: boolean;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  perPage: number;
}

export interface TestResult {
  status: string;
  message: string;
}
