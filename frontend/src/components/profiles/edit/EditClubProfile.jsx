import React, { useState } from 'react';
import { getFullUrl } from '../../../utils/mediaUrl';

const EditClubProfile = ({ user, onSave, loading, errors }) => {
  const stats = user.stats && typeof user.stats === 'object' ? user.stats : {};
  const contact = user.contact && typeof user.contact === 'object' ? user.contact : {};
  const [form, setForm] = useState({
    club: user.club || '',
    city: user.city || '',
    country: user.country || '',
    bio: user.bio || '',
    founded: user.founded ?? stats.founded ?? user.foundingYear ?? '',
    stadium: user.stadium ?? stats.stadium ?? '',
    capacity: user.capacity ?? stats.capacity ?? '',
    league: user.league ?? stats.league ?? '',
    careerHistory: user.careerHistory || '',
    phone: contact.phone || '',
    email: contact.email || '',
    website: contact.website || '',
    instagram: contact.instagram || '',
    facebook: contact.facebook || '',
    twitter: contact.twitter || '',
    profilePhoto: user.profilePhoto || '',
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [preview, setPreview] = useState(user.profilePhoto ? getFullUrl(user.profilePhoto) : '');

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
    const {
      founded,
      stadium,
      capacity,
      league,
      phone,
      email,
      website,
      instagram,
      facebook,
      twitter,
      profilePhoto: _ph,
      ...rest
    } = form;
    Object.entries(rest).forEach(([key, value]) => {
      formData.append(key, value == null ? '' : String(value));
    });
    formData.append('founded', founded === '' || founded == null ? '' : String(founded));
    formData.append('stadium', stadium || '');
    formData.append('capacity', capacity === '' || capacity == null ? '' : String(capacity));
    formData.append('league', league || '');
    formData.append(
      'contact',
      JSON.stringify({
        phone: phone || undefined,
        email: email || undefined,
        website: website || undefined,
        instagram: instagram || undefined,
        facebook: facebook || undefined,
        twitter: twitter || undefined,
      })
    );
    const nextStats = {
      ...(stats || {}),
      founded: founded || undefined,
      stadium: stadium || undefined,
      capacity: capacity !== '' && capacity != null ? Number(capacity) || capacity : undefined,
      league: league || undefined,
    };
    formData.append('stats', JSON.stringify(nextStats));
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Profile Photo</label>
        {preview && (
          <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover mb-2" />
        )}
        <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
      <h3 className="text-lg font-semibold mb-3">Club Profile</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Club Name</label>
          <input name="club" value={form.club} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Viti i themelimit</label>
          <input
            name="founded"
            value={form.founded}
            onChange={handleChange}
            type="number"
            min="1800"
            max="2100"
            placeholder="p.sh. 2017"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stadium</label>
          <input
            name="stadium"
            value={form.stadium}
            onChange={handleChange}
            placeholder="Emri i stadiumit"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Capacity</label>
          <input
            name="capacity"
            value={form.capacity}
            onChange={handleChange}
            type="number"
            min="0"
            placeholder="p.sh. 5000"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Liga (manual)</label>
          <input
            name="league"
            value={form.league}
            onChange={handleChange}
            placeholder="Opsionale — nëse nuk je bashkuar në një ligë në platformë"
            className="w-full p-2 border border-gray-300 rounded"
          />
          <p className="text-xs text-gray-500 mt-1">
            Ligat ku bashkohet klubi shfaqen automatikisht në Overview.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input name="city" value={form.city} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <input name="country" value={form.country} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Bio</label>
        <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Career History</label>
        <textarea name="careerHistory" value={form.careerHistory} onChange={handleChange} rows={2} className="w-full p-2 border border-gray-300 rounded" />
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2 text-gray-800">Kontakt</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Telefon</label>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="+383 ..." className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="klubi@email.com" className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Website</label>
            <input name="website" value={form.website} onChange={handleChange} placeholder="https://..." className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instagram</label>
            <input name="instagram" value={form.instagram} onChange={handleChange} placeholder="@klubi" className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Facebook</label>
            <input name="facebook" value={form.facebook} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Twitter / X</label>
            <input name="twitter" value={form.twitter} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      {errors && errors.general && <div className="text-red-500 mt-2">{errors.general}</div>}
    </form>
  );
};

export default EditClubProfile;
