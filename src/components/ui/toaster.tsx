import { Toaster as SonnerToaster } from 'sonner';

/** App-wide toast host — mount once in `App.tsx`. */
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            'border border-white/10 bg-black/85 text-white backdrop-blur-xl',
          title: 'text-white',
          description: 'text-white/70',
        },
      }}
    />
  );
}
