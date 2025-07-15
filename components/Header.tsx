
import React from 'react';
import SendIcon from './icons/SendIcon';

const Header: React.FC = () => {
  return (
    <header className="text-center p-6 bg-white dark:bg-slate-800/50 shadow-md rounded-xl">
      <div className="flex items-center justify-center gap-4">
        <SendIcon className="w-10 h-10 text-indigo-500" />
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">
          Bulk Email Sender
        </h1>
      </div>
      <p className="mt-3 text-md text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
        Add recipient data as a JSON array to the queue. When you're ready, click "Send Mails" to process the entire batch.
      </p>
    </header>
  );
};

export default Header;
