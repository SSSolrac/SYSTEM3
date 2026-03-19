import { User } from 'lucide-react';
import { DarkModeToggle } from './dark-mode-toggle';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-700">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1A2B47] to-[#1A2B47] bg-clip-text text-transparent">
              Points Balance Check
            </h1>
            <p className="text-gray-600 mt-2 dark:text-gray-300">
              Enter your member ID to view your points balance and transaction history
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DarkModeToggle />
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#1A2B47] to-[#1A2B47] text-white">
              <User className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
