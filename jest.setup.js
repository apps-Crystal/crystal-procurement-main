// jest.setup.js
// Add custom matchers and global setup here if needed

// Mock environment variables for tests
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.GOOGLE_SHEETS_API_KEY = 'test-key-123'

// Mock next/navigation to prevent errors in tests
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Suppress console errors in tests (optional, comment out if you want to see them)
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
