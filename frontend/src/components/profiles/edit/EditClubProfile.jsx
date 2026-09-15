import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getFullUrl } from '../../../utils/mediaUrl';
import api, { ligaAPI } from '../../../services/api';

function clubInLiga(liga, clubUserId) {
  if (clubUserId == null || !liga) return false;
  const id = String(clubUserId);
  const clubs = liga.clubs;
  if (!Array.isArray(clubs)) return false;
  return clubs.some((c) => {
    if (c == null) return false;
    if (typeof c === 'number' || typeof c === 'string') return String(c) === id;
    return String(c.id || c.userId || c.clubId || '') === id;
  });
}

function normalizeLiga(l) {
  return {
    id: String(l.userId || l.User?.id || l.id || ''),
    userId: l.userId || l.User?.id,
    ligaId: l.ligaId || l.id,
    name: l.name || 'Liga',
    logo: l.logo || null,
    level: l.level || null,
    country: l.country || null,
  };
}

const EditClubProfile = ({ user, onSave, loading, errors }) => {
  const stats = user.stats && typeof user.stats === 'object' ? user.stats : {};
  const contact = user.contact && typeof user.contact === 'object' ? user.contact : {};
  const clubUserId = user.userId || user.id || user.User?.id;
  const initialJoined = Array.isArray(user.joinedLigas) ? user.joinedLigas.map(normalizeLiga) : [];

  const [allLigas, setAllLigas] = useState([]);
  const [selectedLigas, setSelectedLigas] = useState(initialJoined);
  const [initialSelectedIds, setInitialSelectedIds] = useState(
    () => new Set(initialJoined.map((l) => String(l.id || l.userId)).filter(Boolean))
  );
  const [loadingLigas, setLoadingLigas] = useState(true);
  const [ligaQuery, setLigaQuery] = useState('');
  const [showLigaDropdown, setShowLigaDropdown] = useState(false);
  const [ligaSyncError, setLigaSyncError] = useState('');
  const dropdownRef = useRef(null);
  const stadiumDropdownRef = useRef(null);

  const [allStadiums, setAllStadiums] = useState([]);
  const [loadingStadiums, setLoadingStadiums] = useState(true);
  const [stadiumId, setStadiumId] = useState(
    user.stadiumId != null ? String(user.stadiumId) : user.Stadium?.id != null ? String(user.Stadium.id) : ''
  );
  const [stadiumQuery, setStadiumQuery] = useState(
    user.Stadium?.name || user.stadium || stats.stadium || ''
  );
  const [showStadiumDropdown, setShowStadiumDropdown] = useState(false);

  const [form, setForm] = useState({
    club: user.club || '',
    city: user.city || '',
    country: user.country || '',
    bio: user.bio || '',
    founded: user.founded ?? stats.founded ?? user.foundingYear ?? '',
    stadium: user.Stadium?.name || user.stadium ?? stats.stadium ?? '',
    capacity: user.Stadium?.capacity ?? user.capacity ?? stats.capacity ?? '',
    careerHistory: user.careerHistory || '',
    phone: contact.phone || '',
    email: contact.email || '',
    website: contact.website || '',
    instagram: contact.instagram || '',
    facebook: contact.facebook || '',
    twitter: contact.twitter || '',
    profilePhoto: user.profilePhoto || '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/stadiums', { params: { limit: 200 } });
        const list = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) {
          setAllStadiums(list);
          if (stadiumId) {
            const found = list.find((s) => String(s.id) === String(stadiumId));
            if (found) {
              setStadiumQuery(found.name || '');
              setForm((prev) => ({
                ...prev,
                stadium: found.name || '',
                capacity: found.capacity != null ? found.capacity : prev.capacity,
              }));
            }
          }
        }
      } catch {
        if (!cancelled) setAllStadiums([]);
      } finally {
        if (!cancelled) setLoadingStadiums(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ligaAPI.getAllLigas();
        const all = (Array.isArray(res.data) ? res.data : []).map(normalizeLiga).filter((l) => l.id);
        if (cancelled) return;
        setAllLigas(all);

        let selected = initialJoined.filter((l) => l.id);
        if (selected.length === 0 && clubUserId) {
          selected = (Array.isArray(res.data) ? res.data : [])
            .filter((l) => clubInLiga(l, clubUserId))
            .map(normalizeLiga)
            .filter((l) => l.id);
        }
        setSelectedLigas(selected);
        setInitialSelectedIds(new Set(selected.map((l) => String(l.id))));
      } catch {
        if (!cancelled) {
          setAllLigas([]);
          setSelectedLigas(initialJoined.filter((l) => l.id));
        }
      } finally {
        if (!cancelled) setLoadingLigas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per club
  }, [clubUserId]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowLigaDropdown(false);
      }
      if (stadiumDropdownRef.current && !stadiumDropdownRef.current.contains(e.target)) {
        setShowStadiumDropdown(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectedIds = useMemo(
    () => new Set(selectedLigas.map((l) => String(l.id || l.userId))),
    [selectedLigas]
  );

  const filteredLigas = useMemo(() => {
    const q = ligaQuery.trim().toLowerCase();
    return allLigas
      .filter((l) => !selectedIds.has(String(l.id)))
      .filter((l) => {
        if (!q) return true;
        const hay = `${l.name || ''} ${l.country || ''} ${l.level || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [allLigas, ligaQuery, selectedIds]);

  const filteredStadiums = useMemo(() => {
    const q = stadiumQuery.trim().toLowerCase();
    return allStadiums
      .filter((s) => {
        if (!q) return true;
        const hay = `${s.name || ''} ${s.city || ''} ${s.country || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 30);
  }, [allStadiums, stadiumQuery]);

  const selectStadium = (s) => {
    setStadiumId(String(s.id));
    setStadiumQuery(s.name || '');
    setForm((prev) => ({
      ...prev,
      stadium: s.name || '',
      capacity: s.capacity != null ? s.capacity : '',
    }));
    setShowStadiumDropdown(false);
  };

  const clearStadium = () => {
    setStadiumId('');
    setStadiumQuery('');
    setForm((prev) => ({ ...prev, stadium: '', capacity: '' }));
  };

  const addLiga = (liga) => {
    const id = String(liga.id || liga.userId);
    if (!id || selectedIds.has(id)) return;
    setSelectedLigas((prev) => [...prev, normalizeLiga(liga)]);
    setLigaQuery('');
    setShowLigaDropdown(true);
  };

  const removeLiga = (ligaId) => {
    const id = String(ligaId);
    setSelectedLigas((prev) => prev.filter((l) => String(l.id || l.userId) !== id));
  };

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

  const syncLigaMemberships = async () => {
    const nextIds = new Set(selectedLigas.map((l) => String(l.id || l.userId)).filter(Boolean));
    const toJoin = [...nextIds].filter((id) => !initialSelectedIds.has(id));
    const toLeave = [...initialSelectedIds].filter((id) => !nextIds.has(id));

    for (const id of toJoin) {
      await ligaAPI.joinLiga(id);
    }
    for (const id of toLeave) {
      await ligaAPI.leaveLiga(id);
    }
    setInitialSelectedIds(nextIds);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLigaSyncError('');
    const formData = new FormData();
    const {
      founded,
      stadium,
      capacity,
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
    formData.append('stadiumId', stadiumId || '');
    formData.append('stadium', stadium || '');
    formData.append('capacity', capacity === '' || capacity == null ? '' : String(capacity));
    const leagueNames = selectedLigas.map((l) => l.name).filter(Boolean).join(', ');
    formData.append('league', leagueNames);
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
      league: leagueNames || undefined,
    };
    formData.append('stats', JSON.stringify(nextStats));
    if (profilePhoto) {
      formData.append('profilePhoto', profilePhoto);
    }

    try {
      await syncLigaMemberships();
    } catch {
      setLigaSyncError('Nuk u përditësuan disa liga. Provo përsëri.');
      return;
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
        <div className="md:col-span-2" ref={stadiumDropdownRef}>
          <label className="block text-sm font-medium mb-1">Stadiumi</label>
          <div className="relative">
            <input
              type="text"
              value={stadiumQuery}
              onChange={(e) => {
                setStadiumQuery(e.target.value);
                setStadiumId('');
                setForm((prev) => ({ ...prev, stadium: e.target.value }));
                setShowStadiumDropdown(true);
              }}
              onFocus={() => setShowStadiumDropdown(true)}
              placeholder={loadingStadiums ? 'Duke ngarkuar stadiumet…' : 'Shkruaj për të kërkuar stadium…'}
              disabled={loadingStadiums}
              className="w-full p-2 border border-gray-300 rounded"
              autoComplete="off"
            />
            {showStadiumDropdown && !loadingStadiums && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-56 overflow-y-auto">
                {filteredStadiums.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    {stadiumQuery.trim()
                      ? 'Nuk u gjet stadium. Shtohet nga Admin → Stadiume.'
                      : allStadiums.length === 0
                        ? 'Nuk ka stadiume në katalog. Admini duhet t’i shtojë.'
                        : 'Shkruaj emrin e stadiumit…'}
                  </p>
                ) : (
                  filteredStadiums.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectStadium(s);
                      }}
                    >
                      <span className="block font-medium text-gray-900">{s.name}</span>
                      <span className="block text-xs text-gray-500">
                        {[s.city, s.country].filter(Boolean).join(' • ')}
                        {s.capacity != null ? ` · ${Number(s.capacity).toLocaleString()} ulëse` : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {stadiumId ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-gray-600">
              <span>
                Kapaciteti: <strong>{form.capacity != null && form.capacity !== '' ? Number(form.capacity).toLocaleString() : '—'}</strong>
              </span>
              <button type="button" onClick={clearStadium} className="text-red-600 hover:underline">
                Hiq stadiumin
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Zgjidh nga katalogu (Admin → Stadiume). Kapaciteti mbushët automatikisht.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Capacity</label>
          <input
            name="capacity"
            value={form.capacity}
            onChange={handleChange}
            type="number"
            min="0"
            placeholder="Automatikisht nga stadiumi"
            readOnly={Boolean(stadiumId)}
            className={`w-full p-2 border border-gray-300 rounded ${stadiumId ? 'bg-slate-50 text-gray-600' : ''}`}
          />
        </div>

        <div className="md:col-span-2" ref={dropdownRef}>
          <label className="block text-sm font-medium mb-1">
            Ligat ku merr pjesë ({selectedLigas.length})
          </label>
          {selectedLigas.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {selectedLigas.map((liga) => {
                const lid = String(liga.id || liga.userId);
                const logo = getFullUrl(liga.logo);
                return (
                  <li
                    key={lid}
                    className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-slate-200 bg-slate-50 pl-1.5 pr-2 py-1 text-sm"
                  >
                    {logo ? (
                      <img src={logo} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                        {String(liga.name || 'L').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="truncate font-medium text-gray-900">{liga.name}</span>
                    <button
                      type="button"
                      onClick={() => removeLiga(lid)}
                      className="ml-0.5 text-slate-400 hover:text-red-600 text-base leading-none shrink-0"
                      aria-label={`Hiq ${liga.name}`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="relative">
            <input
              type="text"
              value={ligaQuery}
              onChange={(e) => {
                setLigaQuery(e.target.value);
                setShowLigaDropdown(true);
              }}
              onFocus={() => setShowLigaDropdown(true)}
              placeholder={loadingLigas ? 'Duke ngarkuar ligat…' : 'Shkruaj për të kërkuar dhe zgjedhur liga…'}
              disabled={loadingLigas}
              className="w-full p-2 border border-gray-300 rounded"
              autoComplete="off"
            />
            {showLigaDropdown && !loadingLigas && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded shadow-md max-h-56 overflow-y-auto">
                {filteredLigas.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    {ligaQuery.trim()
                      ? 'Nuk u gjet asnjë ligë me këtë emër.'
                      : allLigas.length === 0
                        ? 'Nuk ka liga të regjistruara ende.'
                        : 'Të gjitha ligat e disponueshme janë zgjedhur.'}
                  </p>
                ) : (
                  filteredLigas.map((liga) => {
                    const logo = getFullUrl(liga.logo);
                    return (
                      <button
                        type="button"
                        key={liga.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addLiga(liga);
                        }}
                      >
                        {logo ? (
                          <img src={logo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                            {String(liga.name || 'L').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-medium text-gray-900 truncate">{liga.name}</span>
                          {(liga.country || liga.level) && (
                            <span className="block text-xs text-gray-500 truncate">
                              {[liga.country, liga.level].filter(Boolean).join(' • ')}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Zgjidh një ose më shumë liga. Ruajtja i bashkon automatikisht klubin në ligat e zgjedhura.
          </p>
          {ligaSyncError ? <p className="text-sm text-amber-600 mt-1">{ligaSyncError}</p> : null}
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
