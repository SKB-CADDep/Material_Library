import { useWorkspace } from "../../context/WorkSpaceContext";

type WaitingWorkspaceScreenProps = {
  materialsDir: string;
};

export function WaitingWorkspaceScreen({ materialsDir }: WaitingWorkspaceScreenProps) {
  const { refresh, isLoading } = useWorkspace();

  return (
    <div className="open-workspace open-workspace--waiting panel">
      <h1>Ожидание каталога данных…</h1>
      <p>
        Сервер настроен на автоматическое подключение каталога материалов.
        Проверяем доступность монтирования.
      </p>
      <p className="open-workspace-path">
        <span className="open-workspace-label">MATERIALS_DIR:</span> {materialsDir}
      </p>
      <div className="open-workspace-actions">
        <button type="button" onClick={() => void refresh()} disabled={isLoading}>
          {isLoading ? "Проверка…" : "Проверить снова"}
        </button>
      </div>
      <p className="open-workspace-hint">
        Если каталог долго недоступен, обратитесь к администратору сервера.
      </p>
    </div>
  );
}
