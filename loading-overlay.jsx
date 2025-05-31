export function LoadingOverlay({ visible, message = "Carregando..." }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-700 mx-auto" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}