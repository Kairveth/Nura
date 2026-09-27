import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import Field from '../components/Field';
import PhotoField from '../components/PhotoField';

const NEUROTIPO_OPTIONS = ['TDAH', 'Autismo', 'Dislexia', 'Dispraxia', 'No diagnosticado', 'Prefiero no decir'];
const validAge = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 18 && Number(v) <= 120;

export default function ProfileCreate() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearJustSignedUp = useAuthStore((state) => state.clearJustSignedUp);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [form, setForm] = useState({ description: '', age: '', location: '', neurotipo: '' });

  // Si ya hay perfil, esta misma pantalla lo carga y lo edita en vez de duplicar una vista aparte.
  useEffect(() => {
    let active = true;
    client
      .get(`/api/profiles/${user.id}`)
      .then((res) => {
        if (!active) return;
        setExisting(true);
        setForm({
          description: res.data.description ?? '',
          age: res.data.age ?? '',
          location: res.data.location ?? '',
          neurotipo: res.data.neurotipo ?? ''
        });
        if (res.data.photo_url) setPhotoPreview(res.data.photo_url);
      })
      .catch(() => {})
      .finally(() => active && setLoadingProfile(false));
    return () => {
      active = false;
    };
  }, [user.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'description' && value.length > 200) return;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (file) => {
    setPhotoError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const descriptionOk = form.description.trim().length > 0;
  const locationOk = form.location.trim().length > 0;
  const canSubmit = Boolean(photoPreview) && descriptionOk && validAge(form.age) && locationOk && form.neurotipo && !saving && !uploading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let photo_url;
      if (photoFile) {
        setUploading(true);
        const body = new FormData();
        body.append('photo', photoFile);
        try {
          const res = await client.post('/api/profiles/photo', body);
          photo_url = res.data.photo_url;
        } catch (err) {
          setPhotoError(err.response?.data?.error === 'Photo must be 5MB or less' ? 'La foto pesa demasiado. Máximo 5 MB.' : 'No pudimos subir la foto. Inténtalo de nuevo.');
          return;
        } finally {
          setUploading(false);
        }
      }

      const payload = { ...form, age: Number(form.age), ...(photo_url && { photo_url }) };
      if (existing) {
        await client.put('/api/profiles', payload);
      } else {
        await client.post('/api/profiles', payload);
      }
      clearJustSignedUp(); // ya cumplió el onboarding: si vuelve a "/" más tarde, que vaya a /dashboard
      navigate('/feed');
    } catch (err) {
      setError(
        err.response?.status === 400
          ? 'Revisa los datos: descripción hasta 200 caracteres, edad entre 18 y 120.'
          : 'No pudimos guardar tu perfil. Inténtalo de nuevo en un momento.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return <div className="grid min-h-dvh place-items-center bg-fog text-mute">Cargando…</div>;
  }

  return (
    <div className="min-h-dvh bg-fog">
      <div className="mx-auto max-w-sm px-6 py-8">
        <p className="font-display text-2xl font-bold lowercase tracking-tight text-ink [font-stretch:80%]">nura</p>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:88%]">
              {existing ? 'Tu perfil' : 'Completa tu perfil'}
            </h1>
            <p className="mt-2 text-mute">Una foto y una descripción corta. Nada más te hace falta para empezar.</p>
          </div>

          <PhotoField previewUrl={photoPreview} uploading={uploading} error={photoError} onSelect={handlePhotoSelect} />

          <Field
            as="textarea"
            label="Descripción"
            name="description"
            placeholder="Cuéntanos algo directo: qué buscas, qué te describe."
            value={form.description}
            onChange={handleChange}
            hint={`${form.description.length}/200 caracteres`}
            required
          />

          <Field label="Edad" name="age" type="number" inputMode="numeric" min="18" max="120" value={form.age} onChange={handleChange} required />

          <Field label="Ubicación" name="location" placeholder="Ciudad o región" value={form.location} onChange={handleChange} required />

          <Field as="select" label="Tipo de neurodivergencia" name="neurotipo" value={form.neurotipo} onChange={handleChange} required>
            <option value="" disabled>
              Selecciona una opción
            </option>
            {NEUROTIPO_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </Field>

          <div role="alert" aria-live="polite" className="min-h-[1.5rem] text-sm font-semibold text-alert">
            {error}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 w-full rounded-2xl bg-nura text-base font-semibold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-nura-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nura sm:h-14"
          >
            {uploading ? 'Subiendo foto…' : saving ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </form>
      </div>
    </div>
  );
}
