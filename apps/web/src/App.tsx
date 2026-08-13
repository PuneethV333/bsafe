import { useQuery } from '@tanstack/react-query';
import { apiClient } from './lib/apiClient';

function App() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await apiClient.get('/health')).data,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold text-red-500">bSafe</h1>
        <p className="text-slate-400">Silent SOS emergency web app</p>
        <p className="text-sm text-slate-500">
          {isPending
            ? 'Checking API…'
            : isError
              ? 'API unreachable'
              : `API: ${JSON.stringify(data)}`}
        </p>
      </div>
    </div>
  );
}

export default App;
