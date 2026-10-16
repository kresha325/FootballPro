import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { useLocale } from '../contexts/LocaleContext';

const UserManagement = () => {
  const { t } = useLocale();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers();
      setUsers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUserRole = async (userId, newRole) => {
    try {
      await adminAPI.updateUserRole(userId, { role: newRole });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const deleteUser = async (userId) => {
    if (window.confirm(t('Are you sure you want to delete this user?'))) {
      try {
        await adminAPI.deleteUser(userId);
        fetchUsers(); // Refresh the list
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  if (loading) {
    return <div className="text-center mt-10">{t('Loading users...')}</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">{t('User Management')}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-4 py-2 text-left">{t('Name')}</th>
              <th className="px-4 py-2 text-left">{t('Email')}</th>
              <th className="px-4 py-2 text-left">{t('Role')}</th>
              <th className="px-4 py-2 text-left">{t('Premium')}</th>
              <th className="px-4 py-2 text-left">{t('Verified')}</th>
              <th className="px-4 py-2 text-left">{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t dark:border-gray-600">
                <td className="px-4 py-2">{user.firstName} {user.lastName}</td>
                <td className="px-4 py-2">{user.email}</td>
                <td className="px-4 py-2">
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value)}
                    className="border rounded px-2 py-1 dark:bg-gray-700"
                  >
                    <option value="athlete">{t('Athlete')}</option>
                    <option value="coach">{t('Coach')}</option>
                    <option value="scout">{t('Scout')}</option>
                    <option value="manager">{t('Manager')}</option>
                    <option value="referee">{t('Referat')}</option>
                    <option value="club">{t('Club')}</option>
                    <option value="federation">{t('Federation')}</option>
                    <option value="media">{t('Media')}</option>
                    <option value="business">{t('Business')}</option>
                    <option value="admin">{t('Admin')}</option>
                  </select>
                </td>
                <td className="px-4 py-2">{user.premium ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">{user.verified ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
