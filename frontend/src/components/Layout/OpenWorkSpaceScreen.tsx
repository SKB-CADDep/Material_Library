import { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";

export function OpenWorkspaceScreen() {
  const { openDirectory } = useWorkspace();
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await openDirectory(path.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть папку");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="open-workspace panel">
      <h1>Откройте директорию</h1>
      <p>Укажите папку с JSON-файлами материалов</p>
      <input
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="C:\Data\Materials"
      />
      <button type="button" onClick={submit} disabled={loading}>
        {loading ? "Загрузка…" : "Открыть"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}