import { WifiOff } from 'lucide-react'

export function Offline() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 mb-2">Sem Conexão</h2>
        <p className="text-sm text-stone-500 mb-1">Você está offline.</p>
        <p className="text-sm text-stone-400">Conecte-se à internet para continuar usando o sistema.</p>
      </div>
    </div>
  )
}
