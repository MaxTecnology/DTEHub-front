import { AppRouter } from '@/router'
import { ThemeProvider } from '@/store/theme'
import { Toaster } from '@/components/ui/sonner'

function App() {
  return (
    <ThemeProvider>
      <AppRouter />
      <Toaster position="bottom-right" richColors />
    </ThemeProvider>
  )
}

export default App
