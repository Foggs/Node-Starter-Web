import { useHealthCheck } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { data, isLoading, isError } = useHealthCheck();

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-foreground">Welcome</h1>
      <p className="mt-3 text-muted-foreground text-lg">
        Your Node.js + React starter is ready. Edit this page to get started.
      </p>

      <div className="mt-10 p-6 rounded-lg border bg-card">
        <p className="text-sm font-medium text-card-foreground mb-2">API Status</p>
        {isLoading && (
          <Badge variant="secondary">Checking...</Badge>
        )}
        {isError && (
          <Badge variant="destructive">Unreachable</Badge>
        )}
        {data && (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            {data.status}
          </Badge>
        )}
      </div>
    </div>
  );
}
