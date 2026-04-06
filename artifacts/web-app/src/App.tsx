function Header() {
  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="max-w-5xl mx-auto">
        <span className="font-semibold text-gray-900">My App</span>
      </div>
    </header>
  );
}

function Main() {
  return (
    <main className="flex-1 px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
        <p className="mt-3 text-gray-500">Your app starts here. Edit this page to get started.</p>
      </div>
    </main>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-white px-6 py-4">
      <div className="max-w-5xl mx-auto text-sm text-gray-400">
        &copy; {new Date().getFullYear()} My App
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <Main />
      <Footer />
    </div>
  );
}
