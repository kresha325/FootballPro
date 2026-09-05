import { getFullUrl } from '../../utils/mediaUrl';

function DeleteButton({ onClick }) {
  return (
    <button
      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-9 h-9 flex items-center justify-center shadow-lg z-10"
      title="Fshi këtë media"
      onClick={onClick}
      type="button"
    >
      🗑️
    </button>
  );
}

function TitleOverlay({ item, pointerEventsNone = false }) {
  if (!item.title) return null;
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3${
        pointerEventsNone ? ' pointer-events-none' : ''
      }`}
    >
      <h4 className="text-white font-semibold">{item.title}</h4>
      {item.description && (
        <p className="text-white/80 text-sm mt-1 line-clamp-2">{item.description}</p>
      )}
    </div>
  );
}

/** Gallery grid + lightbox for the profile page. */
export default function ProfileGalleryPanel({
  gallery,
  isOwner,
  selectedGalleryImage,
  setSelectedGalleryImage,
  onDeleteItem,
  onSetAsProfilePhoto,
}) {
  return (
    <>
      <div>
        {gallery.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gallery.map((item) => (
              <div
                key={item.id}
                className="group relative bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                onClick={() => item.imageUrl && setSelectedGalleryImage(item)}
              >
                {item.imageUrl && item.imageUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <div className="aspect-video relative">
                    <img
                      src={getFullUrl(item.imageUrl)}
                      alt={item.title || 'Gallery item'}
                      className="w-full h-full object-cover"
                    />
                    <TitleOverlay item={item} />
                    {isOwner && (
                      <DeleteButton onClick={(e) => onDeleteItem(item.id, e)} />
                    )}
                  </div>
                ) : item.imageUrl && item.imageUrl.match(/\.(mp4|mov|avi|webm)$/i) ? (
                  <div className="aspect-video relative">
                    <video
                      src={getFullUrl(item.imageUrl)}
                      controls
                      className="w-full h-full object-cover"
                    />
                    <TitleOverlay item={item} pointerEventsNone />
                    {isOwner && (
                      <DeleteButton onClick={(e) => onDeleteItem(item.id, e)} />
                    )}
                  </div>
                ) : item.videoUrl ? (
                  <div className="aspect-video relative">
                    <video
                      src={getFullUrl(item.videoUrl)}
                      controls
                      className="w-full h-full object-cover"
                    />
                    <TitleOverlay item={item} pointerEventsNone />
                    {isOwner && (
                      <DeleteButton onClick={(e) => onDeleteItem(item.id, e)} />
                    )}
                  </div>
                ) : (
                  <div className="aspect-video flex items-center justify-center bg-gray-200 dark:bg-gray-600 relative">
                    <span className="text-gray-400">📁</span>
                    {isOwner && (
                      <DeleteButton onClick={(e) => onDeleteItem(item.id, e)} />
                    )}
                  </div>
                )}

                <div className="p-3 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📸</div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Nuk ka ende media në galeri</p>
            {isOwner && (
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                Ngarko foto dhe video nga faqja Gallery
              </p>
            )}
          </div>
        )}
      </div>

      {selectedGalleryImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedGalleryImage(null)}
        >
          <div className="relative max-w-6xl max-h-screen" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedGalleryImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition z-10"
              type="button"
            >
              ✕
            </button>
            <img
              src={getFullUrl(selectedGalleryImage.imageUrl)}
              alt={selectedGalleryImage.title}
              className="max-w-full max-h-screen object-contain rounded-lg"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 rounded-b-lg">
              {selectedGalleryImage.title && (
                <h3 className="text-xl font-bold text-white mb-2">{selectedGalleryImage.title}</h3>
              )}
              {selectedGalleryImage.description && (
                <p className="text-white/90 mb-4">{selectedGalleryImage.description}</p>
              )}

              {isOwner && (
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => onSetAsProfilePhoto(selectedGalleryImage.imageUrl, 'profile')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                    type="button"
                  >
                    📷 Vendose si foto profili
                  </button>
                  <button
                    onClick={() => onSetAsProfilePhoto(selectedGalleryImage.imageUrl, 'cover')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition"
                    type="button"
                  >
                    🖼️ Vendose si foto kopertine
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
