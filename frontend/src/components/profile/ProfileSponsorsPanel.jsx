import { getFullUrl } from '../../utils/mediaUrl';

/** Owner-only sponsors tab for the profile page. */
export default function ProfileSponsorsPanel({
  sponsorList,
  sponsorLoading,
  editingSponsorId,
  editingSponsor,
  setEditingSponsor,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}) {
  if (sponsorLoading) {
    return <p className="text-gray-500 dark:text-gray-400">Duke ngarkuar sponsorët...</p>;
  }

  if (!sponsorList.length) {
    return <p className="text-gray-500 dark:text-gray-400">Nuk ke sponsorë ende.</p>;
  }

  return (
    <div className="space-y-4">
      {sponsorList.map((sponsor) => (
        <div
          key={sponsor.id}
          className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
            {sponsor.image ? (
              <img
                src={getFullUrl(sponsor.image)}
                alt={sponsor.name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="text-2xl">🎯</span>
            )}
          </div>

          <div className="flex-1">
            {editingSponsorId === sponsor.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editingSponsor.name}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Emri i firmës"
                />
                <input
                  type="url"
                  value={editingSponsor.link}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, link: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Linku"
                />
              </div>
            ) : (
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{sponsor.name}</div>
                {sponsor.link && (
                  <a
                    href={sponsor.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {sponsor.link}
                  </a>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {sponsor.startDate ? `Start: ${new Date(sponsor.startDate).toLocaleDateString()}` : ''}
                  {sponsor.endDate ? ` • End: ${new Date(sponsor.endDate).toLocaleDateString()}` : ''}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {editingSponsorId === sponsor.id ? (
              <>
                <button
                  onClick={onSave}
                  className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
                >
                  Ruaj
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-900 text-sm hover:bg-gray-300"
                >
                  Anulo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onEdit(sponsor)}
                  className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Ndrysho
                </button>
                <button
                  onClick={() => onDelete(sponsor.id)}
                  className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                >
                  Fshi
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
