import { useState, useEffect } from 'react';
import { galleryAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Gallery = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadType, setUploadType] = useState('photo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const response = await galleryAPI.getGallery();
      console.log('📸 Gallery data received:', response.data);
      console.log('📸 First item:', response.data[0]);
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId, e) => {
    e.stopPropagation(); // Prevent opening modal
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    setDeletingItem(itemId);
    try {
      await galleryAPI.deleteMedia(itemId);
      await fetchGallery();
      alert('Item deleted successfully!');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    } finally {
      setDeletingItem(null);
    }
  };

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('type', uploadType);

    try {
      await galleryAPI.uploadMedia(formData);
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      fetchGallery();
    } catch (error) {
      console.error('Error uploading:', error);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-gray-600 dark:text-gray-400">Loading gallery...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">My Gallery</h1>

      {/* Upload Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Upload Media</h2>
        
        <div className="space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Type</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="photo">Photo</option>
              <option value="video">Video</option>
              <option value="highlight">Highlight</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title..."
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows="2"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          {/* File Upload */}
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept={uploadType === 'video' ? 'video/*' : 'image/*'}
              onChange={handleFileSelect}
              className="flex-1 text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition border border-gray-200 dark:border-gray-700 cursor-pointer relative group"
            onClick={() => item.imageUrl && setSelectedImage(item)}
          >
            {/* Delete button - only show for owner */}
            {user && item.userId === user.id && (
              <button
                onClick={(e) => handleDelete(item.id, e)}
                disabled={deletingItem === item.id}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10"
                title="Delete item"
              >
                {deletingItem === item.id ? '⏳' : '🗑️'}
              </button>
            )}
            
            {item.imageUrl ? (
              <img
                src={`https://192.168.100.57:5098${item.imageUrl}`}
                alt={item.title || 'Gallery item'}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  console.error('❌ Image failed to load:', item.imageUrl);
                  console.error('Full item:', item);
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                }}
                onLoad={() => console.log('✅ Image loaded:', item.imageUrl)}
              />
            ) : item.videoUrl ? (
              <video
                src={`https://192.168.100.57:5098${item.videoUrl}`}
                controls
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-4xl">📁</span>
              </div>
            )}
            
            {(item.title || item.description) && (
              <div className="p-3">
                {item.title && (
                  <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                )}
                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                )}
                {item.type && (
                  <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
                    {item.type}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-lg">No items in gallery yet.</p>
            <p className="text-sm mt-2">Upload your first photo or video above!</p>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-6xl max-h-screen">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition z-10"
            >
              ✕
            </button>
            <img
              src={`https://192.168.100.57:5098${selectedImage.imageUrl}`}
              alt={selectedImage.title}
              className="max-w-full max-h-screen object-contain"
            />
            {(selectedImage.title || selectedImage.description) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 text-white">
                {selectedImage.title && (
                  <h3 className="text-xl font-bold">{selectedImage.title}</h3>
                )}
                {selectedImage.description && (
                  <p className="mt-2">{selectedImage.description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
