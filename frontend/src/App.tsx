import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AppRouter } from './app/router/index'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})

function App() {
  useEffect(() => {
    const theme = localStorage.getItem('theme')
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#f3f4f6',
              border: '1px solid #374151',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1f2937' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1f2937' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App