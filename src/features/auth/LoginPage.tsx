import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { loginSchema, LoginFormData } from '../../lib/validators';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useOffline } from '../../hooks/useOffline';

export function LoginPage() {
  const navigate = useNavigate();
  const isOffline = useOffline();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, data.email, data.password);
      // Update lastLoginAt
      await updateDoc(doc(db, 'users', cred.user.uid), {
        lastLoginAt: Timestamp.now(),
      }).catch(() => {});

      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      const userDoc = snap.data();
      if (userDoc?.role === 'owner' && !userDoc.onboardingDone) {
        navigate('/onboarding');
      } else {
        navigate('/agenda');
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setServerError('Email o contraseña incorrectos');
      } else if (code === 'auth/network-request-failed') {
        setServerError('Sin conexión. Comprueba tu red.');
      } else {
        setServerError('Ha ocurrido un error. Inténtalo de nuevo.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Logo */}
      <div className="text-center mt-8">
        <h1 className="font-serif text-4xl tracking-[0.3em] text-carbon uppercase">LaVirgen</h1>
        <p className="text-sm text-gris mt-1 font-sans">Agenda de peluquería</p>
      </div>

      {isOffline && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-700">
          Sin conexión — inicia sesión cuando te conectes.
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="tu@email.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Contraseña"
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError && (
          <p className="text-sm text-red-600 text-center">{serverError}</p>
        )}

        <Button type="submit" loading={isSubmitting} className="w-full mt-2">
          Iniciar sesión
        </Button>
      </form>

      <button
        onClick={() => setShowRegisterModal(true)}
        className="text-sm text-terracota underline"
      >
        Registrarse
      </button>

      <Modal
        open={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Crear cuenta"
      >
        <p className="text-carbon text-sm leading-relaxed">
          Para crear una cuenta, llama a Jose Cuñado.
        </p>
      </Modal>
    </div>
  );
}
