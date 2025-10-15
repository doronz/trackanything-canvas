import React from 'react';
import { RegistryServer } from './types';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface RegistryServerCardProps {
  server: RegistryServer;
  onInstall: (server: RegistryServer) => void;
}

export default function RegistryServerCard({ server, onInstall }: RegistryServerCardProps) {
  return (
    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">{server.name}</h4>
            <span className="text-sm text-gray-500 dark:text-gray-400">v{server.version}</span>
            {server.is_official && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <StarIconSolid className="w-3 h-3 mr-1" />
                Official
              </span>
            )}
            {server.verification_status === 'verified' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Verified
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{server.description}</p>

          {/* Server Metadata */}
          <div className="flex items-center space-x-6 text-xs text-gray-500 dark:text-gray-400 mb-3">
            <span>Author: {server.author}</span>
            <span>License: {server.license}</span>
            <span>Downloads: {server.download_count?.toLocaleString()}</span>
            <span className="flex items-center">
              Trust Score:
              <span className="ml-1 font-medium text-yellow-600">
                {server.trust_score?.toFixed(1)}/10
              </span>
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            {server.category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300">
                {server.category}
              </span>
            )}
            {server.tags?.slice(0, 4).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300"
              >
                {tag}
              </span>
            ))}
            {server.tags && server.tags.length > 4 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{server.tags.length - 4} more
              </span>
            )}
          </div>

          {/* Capabilities */}
          {server.capabilities?.length > 0 && (
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center">
                <WrenchScrewdriverIcon className="w-3 h-3 mr-1" />
                {server.capabilities.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          {server.documentation_url && (
            <a
              href={server.documentation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
              title="View Documentation"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => onInstall(server)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
