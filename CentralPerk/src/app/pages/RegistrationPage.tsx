import { RegistrationCard } from '../components/RegistrationCard';
import { Link } from 'react-router-dom';

export function RegistrationPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] p-6">
      <div className="flex flex-col items-center w-full max-w-5xl">
        <RegistrationCard />
        <p className="mt-6 text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <span className="text-gray-400">Already have an account?</span>{' '}
          <Link to="/login" className="text-[#1bb9d3] hover:text-[#18a9c0] transition-colors font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}


