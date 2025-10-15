import React from 'react';
import { DirectoryServer } from './types';
import {
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
  WrenchScrewdriverIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

interface DirectoryServerCardProps {
  server: DirectoryServer;
  onSelect: (server: DirectoryServer) => void;
}

export default function DirectoryServerCard({ server, onSelect }: DirectoryServerCardProps) {
  const formatTag = (tag: string) => {
    // Map emojis to readable text
    const tagMap: Record<string, string> = {
      '🎖️': 'Official',
      '🐍': 'Python',
      '📇': 'TypeScript',
      '☕': 'Java',
      '🏎️': 'Go',
      '☁️': 'Cloud',
      '🏠': 'Local',
      '🍎': 'macOS',
      '🪟': 'Windows',
      '🐧': 'Linux',
    };
    return tagMap[tag] || tag;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          {/* Server Header */}
          <div className="flex items-center space-x-3">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">{server.name}</h4>
            {server.is_official && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                🎖️ Official
              </span>
            )}
            {server.stars > 0 && (
              <div className="flex items-center space-x-1 text-yellow-500">
                <StarIconSolid className="w-4 h-4" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{server.stars}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400">{server.short_description}</p>

          {/* Tags and Language */}
          <div className="flex items-center space-x-2">
            {server.programming_language && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                <CodeBracketIcon className="w-3 h-3 mr-1" />
                {server.programming_language}
              </span>
            )}
            {server.category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                {server.category}
              </span>
            )}
            {server.tags?.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                title={formatTag(tag)}
              >
                {tag}
              </span>
            ))}
            {server.tags && server.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{server.tags.length - 3} more
              </span>
            )}
          </div>

          {/* Capabilities */}
          {(server.tools_provided?.length > 0 || server.resources_provided?.length > 0) && (
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              {server.tools_provided?.length > 0 && (
                <span className="flex items-center">
                  <WrenchScrewdriverIcon className="w-3 h-3 mr-1" />
                  {server.tools_provided.length} tools
                </span>
              )}
              {server.resources_provided?.length > 0 && (
                <span className="flex items-center">
                  <InformationCircleIcon className="w-3 h-3 mr-1" />
                  {server.resources_provided.length} resources
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 ml-4">
          <a
            href={server.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
            title="View on GitHub"
          >
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
          <button
            onClick={() => onSelect(server)}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#FF5A78] to-[#FFC850] border-transparent rounded-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
