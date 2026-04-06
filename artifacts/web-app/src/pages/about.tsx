export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-foreground">About</h1>
      <p className="mt-3 text-muted-foreground text-lg">
        This is a bare-bones starter built on Node.js, Express, React, and Vite.
      </p>

      <ul className="mt-8 space-y-2 text-sm text-muted-foreground list-disc list-inside">
        <li>React + Vite frontend with Tailwind CSS and shadcn/ui components</li>
        <li>Express 5 backend with TypeScript</li>
        <li>PostgreSQL + Drizzle ORM for the database</li>
        <li>OpenAPI spec with auto-generated React Query hooks</li>
        <li>pnpm workspace monorepo</li>
      </ul>
    </div>
  );
}
