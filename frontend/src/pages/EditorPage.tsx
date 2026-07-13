import { useQuery} from "@tanstack/react-query";
import { listMaterials } from "../api/materials";

export function EditorPage() {
    const result = useQuery({
        queryKey: ["materials"],
        queryFn: listMaterials,
      });
    if (result.isLoading){
        return <p>Загрузка</p>
    }
    if (result.isError){
        return <p>Ошибка</p>
    }
    return (
        <div className="editor-page">
          <h1>Работа с материалами</h1>
          <p>Всего: {result.data.length}</p>
      
          <ul>
            {result.data.map((material) => (
              <li key={material.id}>
                {material.name}
                <span className="filename"> ({material.filename})</span>
              </li>
            ))}
          </ul>
        </div>
      );
  }