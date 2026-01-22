import React, { useState } from 'react';


const EditBusinessProfile = ({ user, onSave, loading, errors }) => {
  const [form, setForm] = useState({
    industry: user.stats?.industry || '',
    founded: user.stats?.founded || '',
    companySize: user.stats?.companySize || '',
    revenue: user.stats?.revenue || '',
    employees: user.stats?.employees || '',
    partnerships: user.stats?.partnerships || '',
    countries: user.stats?.countries || '',
    city: user.city || '',
    country: user.country || '',
    bio: user.bio || '',
    phone: user.contact?.phone || '',
    instagram: user.contact?.instagram || '',
    twitter: user.contact?.twitter || '',
    facebook: user.contact?.facebook || '',
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [preview, setPreview] = useState(user.profilePhoto || '');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setProfilePhoto(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const contact = {
      phone: form.phone,
      instagram: form.instagram,
      twitter: form.twitter,
      facebook: form.facebook,
    };
    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (!['phone','instagram','twitter','facebook'].includes(key)) {
        formData.append(key, value);
      }
    });
    formData.append('contact', JSON.stringify(contact));
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
      <h3 className="text-lg font-semibold mb-3">Business Profile</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Profile Photo</label>
        {preview && (
          <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover mb-2" />
        )}
        <input type="file" name="profilePhoto" accept="image/*" onChange={handleFileChange} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Industry</label>
          <input name="industry" value={form.industry} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Founded</label>
          <input name="founded" value={form.founded} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Company Size</label>
          <input name="companySize" value={form.companySize} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Annual Revenue</label>
          <input name="revenue" value={form.revenue} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Employees</label>
          <input name="employees" value={form.employees} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Partnerships</label>
          <input name="partnerships" value={form.partnerships} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Countries</label>
          <input name="countries" value={form.countries} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
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
        <label className="block text-sm font-medium mb-1">Phone</label>
        <input name="phone" type="text" value={form.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded mb-2" />
        <label className="block text-sm font-medium mb-1">Instagram</label>
        <input name="instagram" type="text" value={form.instagram} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded mb-2" />
        <label className="block text-sm font-medium mb-1">Twitter</label>
        <input name="twitter" type="text" value={form.twitter} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded mb-2" />
        <label className="block text-sm font-medium mb-1">Facebook</label>
        <input name="facebook" type="text" value={form.facebook} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
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

export default EditBusinessProfile;
