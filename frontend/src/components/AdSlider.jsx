import { useState, useEffect } from "react";
import { adsAPI } from '../services/api';

export default function AdSlider() {
  const [ads, setAds] = useState([]);
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', text: '', color: '#34d399', image: null, imageUrl: '', days: 1 });
  const [error, setError] = useState('');
  // Load ads from backend
  // Shuffle array helper
  function shuffle(array) {
    let arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  useEffect(() => {
    adsAPI.getAds().then(res => {
      if (res.data && res.data.length > 0) {
        const shuffled = shuffle(res.data);
        setAds(shuffled);
        // Fillo nga një indeks random
        setActive(Math.floor(Math.random() * shuffled.length));
      } else {
        setAds([]);
      }
    });
  }, []);

  // Auto-slide every 1.5 seconds, unless paused
  useEffect(() => {
    if (isPaused || ads.length === 0) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % ads.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPaused, ads]);

  // Shto reklamë nga jashtë (event custom) dhe hap modalin nga burger menu
  useEffect(() => {
    function handleAddAd(e) {
      if (e.detail && e.detail.ad) {
        setAds((prev) => [...prev, e.detail.ad]);
      }
    }
    function handleOpenModal() {
      setShowModal(true);
    }
    window.addEventListener('add-ad', handleAddAd);
    window.addEventListener('open-ad-modal', handleOpenModal);
    return () => {
      window.removeEventListener('add-ad', handleAddAd);
      window.removeEventListener('open-ad-modal', handleOpenModal);
    };
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setForm(f => ({ ...f, image: file, imageUrl: url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.text || !form.days || isNaN(form.days) || Number(form.days) < 1) {
      setError('Plotëso të gjitha fushat dhe cakto ditët (1+).');
      return;
    }
    const data = new FormData();
    data.append('title', form.title);
    data.append('text', form.text);
    data.append('color', form.color);
    data.append('days', Number(form.days));
    if (form.image) data.append('image', form.image);
    try {
      await adsAPI.createAd(data);
      // Rifresko ads nga backend
      const res = await adsAPI.getAds();
      setAds(res.data);
      setForm({ title: '', text: '', color: '#34d399', image: null, imageUrl: '', days: 1 });
      setShowModal(false);
    } catch (err) {
      setError('Nuk u shtua reklama. Provo sërish.');
    }
  };

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mt-6 text-center border border-gray-200 dark:border-gray-600">
      {/* Modal për shtim reklame */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-80 space-y-4">
            <h2 className="text-lg font-bold mb-2">Shto reklamë</h2>
            <input type="text" className="w-full p-2 rounded border" placeholder="Titulli" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <input type="text" className="w-full p-2 rounded border" placeholder="Teksti" value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))} />
            <input type="color" className="w-8 h-8" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <input
                  type="number"
                  min="1"
                  className="w-full p-2 rounded border pr-12"
                  placeholder="Numri i ditëve"
                  value={form.days}
                  onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300 text-sm pointer-events-none">Ditë</span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">1 euro/ditë</span>
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full" />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded mt-2" />
            )}
            {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
            <div className="flex gap-2 mt-2">
              <button type="submit" className="flex-1 bg-green-500 text-white rounded p-2">Shto</button>
              <button type="button" className="flex-1 bg-gray-300 dark:bg-gray-600 rounded p-2" onClick={() => setShowModal(false)}>Anulo</button>
            </div>
          </form>
        </div>
      )}
      {ads.length > 0 ? (
        <>
          <div
            style={{ background: ads[active].color }}
            className="rounded-lg p-0 mb-2 overflow-hidden cursor-pointer"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {ads[active].imageUrl && (
              <div className="w-full h-56 flex items-center justify-center bg-white dark:bg-gray-800">
                <img
                  src={
                    ads[active].imageUrl.startsWith('blob:')
                      ? ads[active].imageUrl
                      : ads[active].imageUrl.startsWith('/uploads/')
                        ? `http://192.168.100.57:5098${ads[active].imageUrl}`
                        : ads[active].imageUrl
                  }
                  alt="Ad"
                  className="max-w-full max-h-full object-contain block"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            )}
            {/* Nëse vjen nga backend, përdor ads[active].image ose ads[active].imageUrl */}
          </div>
          <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">{ads[active].title}</div>
          <div className="mb-2 text-gray-800 dark:text-gray-200">{ads[active].text}</div>
          <div className="flex justify-center gap-2 mt-2">
            {ads.map((_, i) => (
              <button
                key={i}
                className={`w-3 h-3 rounded-full focus:outline-none ${i === active ? "bg-black" : "bg-gray-400"}`}
                onClick={() => setActive(i)}
                aria-label={`Go to ad ${i + 1}`}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-gray-500 dark:text-gray-300">Nuk ka asnjë reklamë.</div>
      )}
    </div>
  );
}
