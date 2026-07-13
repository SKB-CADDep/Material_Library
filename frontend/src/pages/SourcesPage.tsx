import { useQuery} from "@tanstack/react-query";
import { getSources } from "../api/sources";

export function SourcesPage() {
    const result = useQuery({
        queryKey: ["sources"],
        queryFn: getSources,
      });
    if (result.isLoading){
        return <p>Загрузка</p>
    }
    if (result.isError){
        return <p>Ошибка</p>
    }
    return (
      <div className="source-page">
        <h1>Работа с источниками</h1>
        <p>Физические: {result.data.property_sources.length}</p>
      </div>
    );
  }