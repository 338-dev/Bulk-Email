
import React from 'react';
import { Recipient, StatusMap, SendStatus } from '../types';
import SendIcon from './icons/SendIcon';
import UserGroupIcon from './icons/UserGroupIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ClockIcon from './icons/ClockIcon';
import XCircleIcon from './icons/XCircleIcon';

interface RecipientListProps {
  recipients: Recipient[];
  onSend: () => void;
  isSending: boolean;
  statuses: StatusMap;
}

const StatusIndicator: React.FC<{ status: SendStatus }> = ({ status }) => {
  switch (status) {
    case SendStatus.SENDING:
      return (
        <span className="flex items-center gap-2 text-blue-500">
          <ClockIcon className="w-5 h-5 animate-spin-slow" />
          Sending...
        </span>
      );
    case SendStatus.SENT:
      return (
        <span className="flex items-center gap-2 text-green-500">
          <CheckCircleIcon className="w-5 h-5" />
          Sent
        </span>
      );
    case SendStatus.FAILED:
        return (
          <span className="flex items-center gap-2 text-red-500">
            <XCircleIcon className="w-5 h-5" />
            Failed
          </span>
        );
    case SendStatus.PENDING:
    default:
      return (
        <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <ClockIcon className="w-5 h-5" />
          Pending
        </span>
      );
  }
};


const RecipientList: React.FC<RecipientListProps> = ({ recipients, onSend, isSending, statuses }) => {
  if (recipients.length === 0) {
    return (
      <div className="text-center p-12 bg-white dark:bg-slate-800/50 rounded-xl shadow-md">
        <UserGroupIcon className="w-16 h-16 mx-auto text-slate-400 dark:text-slate-500" />
        <h3 className="mt-4 text-xl font-semibold text-slate-800 dark:text-slate-100">The Queue is Empty</h3>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Add some recipients using the form above to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <UserGroupIcon className="w-6 h-6" />
            Recipient Queue
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mt-1">{recipients.length} recipient(s) waiting to be processed.</p>
        </div>
        <button
          onClick={onSend}
          disabled={isSending}
          className="flex items-center justify-center gap-2 px-6 py-3 w-full sm:w-auto bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-slate-900 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : (
            <>
              <SendIcon className="w-5 h-5" />
              Send Mails Now
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Name</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Email</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Company</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {recipients.map((recipient) => (
              <tr key={recipient.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <td className="p-4 text-slate-800 dark:text-slate-200 font-medium">{recipient.name}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{recipient.email}</td>
                <td className="p-4 text-slate-600 dark:text-slate-400">{recipient.company}</td>
                <td className="p-4 text-sm font-medium">
                  <StatusIndicator status={statuses[recipient.id] || SendStatus.PENDING} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecipientList;
