import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { setOnboardingPending } from './RegisterOnboarding';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'athlete',
    dateOfBirth: '',
  });

  // initialize DOB parts from initial formData.dateOfBirth (no effects)
  const initialDobParts = (() => {
    if (formData.dateOfBirth) {
      const parts = formData.dateOfBirth.split('-');
      if (parts.length === 3) return { year: parts[0], month: parts[1], day: parts[2] };
    }
    return { year: '', month: '', day: '' };
  })();

  const [dobDay, setDobDay] = useState(initialDobParts.day);
  const [dobMonth, setDobMonth] = useState(initialDobParts.month);
  const [dobYear, setDobYear] = useState(initialDobParts.year);
  const [showNativePicker, setShowNativePicker] = useState(false);

  const updateFormDob = (y, m, d) => {
    if (y && m && d) {
      const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      setFormData((prev) => ({ ...prev, dateOfBirth: iso }));
    } else {
      setFormData((prev) => ({ ...prev, dateOfBirth: '' }));
    }
  };

  const handleDobDayChange = (value) => {
    const v = value.replace(/[^0-9]/g, '').slice(0, 2);
    setDobDay(v);
    updateFormDob(dobYear, dobMonth, v);
  };

  const handleDobMonthChange = (value) => {
    const v = value;
    setDobMonth(v);
    updateFormDob(dobYear, v, dobDay);
  };

  const handleDobYearChange = (value) => {
    const v = value.replace(/[^0-9]/g, '').slice(0, 4);
    setDobYear(v);
    updateFormDob(v, dobMonth, dobDay);
  };

  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailExists(false);

    // Validation
    if (!formData.firstName.trim()) {
      setError('Emri është i detyrueshëm');
      setLoading(false);
      return;
    }
    if (!formData.lastName.trim()) {
      setError('Mbiemri është i detyrueshëm');
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('Email-i është i detyrueshëm');
      setLoading(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Ju lutem shkruani një adresë email-i të vlefshme');
      setLoading(false);
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setError('Fjalëkalimi duhet të ketë të paktën 6 karaktere');
      setLoading(false);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Fjalëkalimet nuk përputhen');
      setLoading(false);
      return;
    }
    if (!formData.dateOfBirth) {
      setError('Data e lindjes është e detyrueshme');
      setLoading(false);
      return;
    }

    console.log('FRONTEND: Submitting registration...');
    const result = await register({
      email: formData.email,
      password: formData.password,
      role: formData.role,
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth || undefined,
    });
    setLoading(false);
    if (result.success) {
      console.log('FRONTEND: Registration successful');
      setOnboardingPending();
      navigate('/onboarding');
    } else {
      console.error('FRONTEND: Registration failed:', result.error);
      setError(result.error || 'Regjistrimi dështoi. Provo përsëri.');
      setEmailExists(!!result.emailAlreadyExists);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Krijo llogarinë FootballPro
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Profil, video, turne dhe lidhje me skautë — fillo me regjistrim të plotë
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div id="error-message" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert" aria-live="assertive">
              <span className="block sm:inline">{error}</span>
              {emailExists ? (
                <p className="mt-2 text-sm">
                  <Link to="/login" className="font-semibold underline text-red-800">
                    Shko te hyrja
                  </Link>
                </p>
              ) : null}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">Data e lindjes</label>
              <div className="mt-1 flex gap-2 items-center">
                <input
                  id="dob-day"
                  name="dobDay"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="DD"
                  autoComplete="bday-day"
                  value={dobDay}
                  onChange={(e) => handleDobDayChange(e.target.value)}
                  className="w-16 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  aria-describedby={error ? "error-message" : undefined}
                />
                <select
                  id="dob-month"
                  name="dobMonth"
                  autoComplete="bday-month"
                  value={dobMonth}
                  onChange={(e) => handleDobMonthChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Muaji</option>
                  <option value="01">Janar</option>
                  <option value="02">Shkurt</option>
                  <option value="03">Mars</option>
                  <option value="04">Prill</option>
                  <option value="05">Maj</option>
                  <option value="06">Qershor</option>
                  <option value="07">Korrik</option>
                  <option value="08">Gusht</option>
                  <option value="09">Shtator</option>
                  <option value="10">Tetor</option>
                  <option value="11">Nëntor</option>
                  <option value="12">Dhjetor</option>
                </select>
                <input
                  id="dob-year"
                  name="dobYear"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="YYYY"
                  autoComplete="bday-year"
                  value={dobYear}
                  onChange={(e) => handleDobYearChange(e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNativePicker((s) => !s)}
                  className="ml-1 px-2 py-2 border border-gray-300 rounded-md text-sm bg-white"
                  aria-label="Hap mbyll përzgjedhësin e kalendarit"
                >
                  📅
                </button>
              </div>
              {showNativePicker && (
                <div className="mt-2">
                  <input
                    type="date"
                    autoComplete="bday"
                    value={formData.dateOfBirth || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({ ...prev, dateOfBirth: val }));
                      const parts = val.split('-');
                      if (parts.length === 3) {
                        setDobYear(parts[0]);
                        setDobMonth(parts[1]);
                        setDobDay(parts[2]);
                      }
                    }}
                    className="mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              )}
            </div>
            <div>
              <label htmlFor="firstName" className="sr-only">Emri</label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                autoComplete="given-name"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Emri"
                value={formData.firstName}
                onChange={handleChange}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="sr-only">Mbiemri</label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                autoComplete="family-name"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Mbiemri"
                value={formData.lastName}
                onChange={handleChange}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">Adresa e email-it</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Adresa e email-it"
                value={formData.email}
                onChange={handleChange}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <div>
              <label htmlFor="role" className="sr-only">Roli</label>
              <select
                id="role"
                name="role"
                required
                autoComplete="organization-title"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={formData.role}
                onChange={handleChange}
                aria-describedby={error ? "error-message" : undefined}
              >
                <option value="athlete">Atlet</option>
                <option value="coach">Trajner</option>
                <option value="scout">Scout</option>
                <option value="manager">Menaxher</option>
                <option value="referee">Referat</option>
                <option value="club">Klub</option>
                <option value="federation">Federatë</option>
                <option value="media">Media</option>
                <option value="business">Biznes</option>
              </select>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Fjalëkalimi</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Fjalëkalimi"
                value={formData.password}
                onChange={handleChange}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">Konfirmo fjalëkalimin</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Konfirmo fjalëkalimin"
                value={formData.confirmPassword}
                onChange={handleChange}
                aria-describedby={error ? "error-message" : undefined}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Duke krijuar llogarinë...' : 'Regjistrohu'}
            </button>
          </div>
          <div className="text-center">
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Ke llogari? Hyr
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;