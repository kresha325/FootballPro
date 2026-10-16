import React, { useState } from 'react';
import { useLocale } from '../../../contexts/LocaleContext';

function asObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

const EditRefereeProfile = ({ user, onSave, loading, errors }) => {
  const { t } = useLocale();
  const contact = asObject(user.contact);
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    bio: user.bio || '',
    city: user.city || '',
    country: user.country || '',
    careerHistory: typeof user.careerHistory === 'string' ? user.careerHistory : '',
    phone: contact.phone || '',
    email: contact.email || '',
    website: contact.website || '',
    instagram: contact.instagram || '',
    facebook: contact.facebook || '',
    twitter: contact.twitter || '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [preview, setPreview] = useState(user.profilePhoto || '');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfilePhoto(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    ['firstName', 'lastName', 'bio', 'city', 'country', 'careerHistory'].forEach((key) => {
      formData.append(key, form[key] == null ? '' : String(form[key]));
    });
    formData.append(
      'contact',
      JSON.stringify({
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        instagram: form.instagram || undefined,
        facebook: form.facebook || undefined,
        twitter: form.twitter || undefined,
      })
    );
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{t('Foto e profilit')}</label>
        {preview ? <img src={preview} alt={t('Preview')} className="w-24 h-24 rounded-full object-cover mb-2" /> : null}
        <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
      <h3 className="text-lg font-semibold mb-3">{t('Profili i Arbitrit')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('Emri')} *</label>
          <input name="firstName" value={form.firstName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Mbiemri')} *</label>
          <input name="lastName" value={form.lastName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('Bio')}</label>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={4} maxLength={500} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('Qyteti')}</label>
          <input name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t('Shteti')}</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('Historia e karrierës')}</label>
        <textarea name="careerHistory" value={form.careerHistory} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">{t('Kontakt')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('Telefon')}</label>
            <input name="phone" value={form.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Email')}</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Website')}</label>
            <input name="website" value={form.website} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Instagram')}</label>
            <input name="instagram" value={form.instagram} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Facebook')}</label>
            <input name="facebook" value={form.facebook} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('Twitter / X')}</label>
            <input name="twitter" value={form.twitter} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? t('Duke ruajtur…') : t('Ruaj ndryshimet')}
        </button>
      </div>
      {errors?.general ? <div className="text-red-600 mt-2">{errors.general}</div> : null}
    </form>
  );
};

export default EditRefereeProfile;
