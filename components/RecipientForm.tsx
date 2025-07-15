
import React, { useState } from 'react';
import { Recipient } from '../types';
import UserGroupIcon from './icons/UserGroupIcon';

interface RecipientFormProps {
  onAddRecipients: (recipients: Omit<Recipient, 'id'>[]) => Promise<void>;
  onError: (message: string) => void;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_INPUT = `[
    { "name": "Ishani Singh", "email": "ishani.singh@example.com", "company": "Innovate Inc" }
]`;

const RecipientForm: React.FC<RecipientFormProps> = ({ onAddRecipients, onError }) => {
  const [inputText, setInputText] = useState(DEFAULT_INPUT);
  const [isAdding, setIsAdding] = useState(false);

  const validateRecipients = (data: any[]): data is Omit<Recipient, 'id'>[] => {
    if (!Array.isArray(data)) {
      onError('Input must be a valid JSON array.');
      return false;
    }

    for (const item of data) {
      if (typeof item !== 'object' || item === null) {
        onError('Each item in the array must be an object.');
        return false;
      }
      if (typeof item.name !== 'string' || !item.name.trim()) {
        onError(`Invalid or missing 'name' for item: ${JSON.stringify(item)}`);
        return false;
      }
      if (typeof item.email !== 'string' || !emailRegex.test(item.email)) {
        onError(`Invalid or missing 'email' for item: ${JSON.stringify(item)}`);
        return false;
      }
      if (typeof item.company !== 'string' || !item.company.trim()) {
        onError(`Invalid or missing 'company' for item: ${JSON.stringify(item)}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    onError(''); // Clear previous errors
    if (!inputText.trim()) {
      onError('Input cannot be empty.');
      return;
    }

    try {
      const sanitizedInput = sanitizeJsonInput(inputText.trim());

      const parsedData = JSON.parse(sanitizedInput);
      if (validateRecipients(parsedData)) {
        setIsAdding(true);
        // ID is now a backend concern. Await the async operation.
        await onAddRecipients(parsedData);
        setInputText(''); // Clear on success
      }
    } catch (e) {
      if (e instanceof Error) {
        onError('Invalid JSON format. Please check for syntax errors.');
      }
    } finally {
        setIsAdding(false);
    }
  };

  const sanitizeJsonInput = (input: any) => {
    let sanitized = input;
    
    // Replace single quotes with double quotes for string values
    // This regex matches 'value' but not property names
    sanitized = sanitized.replace(/'([^']*?)'/g, '"$1"');
    
    // Add quotes around unquoted property names
    // This regex matches property names that aren't already quoted
    sanitized = sanitized.replace(/(\w+)(\s*):/g, '"$1"$2:');
    
    // Handle trailing commas (remove them)
    sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');
    
    return sanitized;
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-xl shadow-md">
      <label htmlFor="recipient-json" className="block text-lg font-medium text-slate-700 dark:text-slate-200">
        Recipient Data (JSON Array)
      </label>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">
        Paste an array of recipient objects. Each object must have `name`, `email`, and `company` keys.
      </p>
      <textarea
        id="recipient-json"
        rows={10}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        className="w-full p-3 font-mono text-sm bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
        placeholder={DEFAULT_INPUT}
        disabled={isAdding}
      />
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isAdding}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
            {isAdding ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                </>
            ) : (
                <>
                    <UserGroupIcon className="w-5 h-5" />
                    Add to Queue
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default RecipientForm;
