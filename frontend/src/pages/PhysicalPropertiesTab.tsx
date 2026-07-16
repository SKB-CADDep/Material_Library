import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type PhysicalPropertiesTabProps = {
  material: Record<string, unknown> | undefined;
};

type ChartPoint = { temperature: number; value: number };

function toChartData(pairs: Array<[number, number]> | undefined): ChartPoint[] {
  return (pairs ?? []).map(([temperature, value]) => ({ temperature, value }));
}

type TemperatureGraphProps = {
  data: ChartPoint[];
  yLabel?: string;
};

function TemperatureGraph({ data, yLabel = "Значение" }: TemperatureGraphProps) {
  if (data.length === 0) {
    return <p className="tab-placeholder">Нет данных для графика</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="temperature"
          label={{ value: "T, °C", position: "insideBottom", offset: -5 }}
        />
        <YAxis label={{ value: yLabel, angle: -90, position: "insideLeft" }} />
        <Tooltip
          formatter={(value) => [value, "Значение"]}
          labelFormatter={(label) => `Температура: ${label}°C`}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3D5A80"
          strokeWidth={2}
          dot={{ fill: "#3D5A80", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PhysicalPropertiesTab({ material}: PhysicalPropertiesTabProps){
  if (!material) {
    return <p className="tab-placeholder">Выберите материал в списке выше</p>;
  }

  const physical_properties = material.physical_properties as {
    modulus_elasticity?: { 
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource: string | number | readonly string[] | undefined;
    };
    coefficient_linear_expansion?:{
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource: string | number | readonly string[] | undefined;
    };
    coefficient_thermal_conductivity?:{
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
      property_subsource: string | number | readonly string[] | undefined;
    };
    density?:{
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
    };
    specific_heat?:{
      temperature_value_pairs?: Array<[number, number]>;
      value_unit?: string;
      comment?: string;
    }
  };

  return(
  <form className="general-form" onSubmit={(e) => e.preventDefault()}>
      <div className="form-stack">
        <div className="form-row"></div>
          <fieldset className="form-section">
            <legend>Модуль упругости (E)</legend>
            <div className="property-section-layout">
            <div className="property-section-fields">
              <div className="form-row">
                <label htmlFor="value_unit">Ед. изм:</label>
                <input
                id="value_unit"
                type="text"
                value={physical_properties.modulus_elasticity?.value_unit ?? ""}
                className="input"
                onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="property_subsource">Источник свойств:</label>
            <input
              id="property_subsource"
              type="number"
              value={physical_properties.modulus_elasticity?.property_subsource ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="comment">Комментарий:</label>
            <input
              id="comment"
              type="text"
              value={physical_properties.modulus_elasticity?.comment ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
        </div>
        <div className="property-section-chart"> 
          <TemperatureGraph
            data={toChartData(physical_properties.modulus_elasticity?.temperature_value_pairs)}
            yLabel="E, МПа"
          />
        </div>
      </div>
        </fieldset>
        <fieldset className="form-section">
            <legend>Коэффицент линейного расширения (·10⁻⁶)(α)</legend>
              <div className="form-row">
                <label htmlFor="value_unit">Ед. изм:</label>
                <input
                id="value_unit"
                type="text"
                value={physical_properties.coefficient_linear_expansion?.value_unit ?? ""}
                className="input"
                onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="property_subsource">Источник свойств:</label>
            <input
              id="property_subsource"
              type="number"
              value={physical_properties.coefficient_linear_expansion?.property_subsource ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="comment">Комментарий:</label>
            <input
              id="comment"
              type="text"
              value={physical_properties.coefficient_linear_expansion?.comment ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;}}
            />
        </div>
      </fieldset>
      <fieldset className="form-section">
            <legend>Коэффицент теплопроводности (λ)</legend>
              <div className="form-row">
                <label htmlFor="value_unit">Ед. изм:</label>
                <input
                id="value_unit"
                type="text"
                value={physical_properties.coefficient_thermal_conductivity?.value_unit ?? ""}
                className="input"
                onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="property_subsource">Источник свойств:</label>
            <input
              id="property_subsource"
              type="number"
              value={physical_properties.coefficient_thermal_conductivity?.property_subsource ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="comment">Комментарий:</label>
            <input
              id="comment"
              type="text"
              value={physical_properties.coefficient_thermal_conductivity?.comment ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;}}
            />
        </div>
      </fieldset>
      <fieldset className="form-section">
            <legend>Плотность (ρ)</legend>
              <div className="form-row">
                <label htmlFor="value_unit">Ед. изм:</label>
                <input
                id="value_unit"
                type="text"
                value={physical_properties.density?.value_unit ?? ""}
                className="input"
                onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="comment">Комментарий:</label>
            <input
              id="comment"
              type="text"
              value={physical_properties.density?.comment ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;}}
            />
        </div>
      </fieldset>
      <fieldset className="form-section">
            <legend>Удельная теплоёмкость (C)</legend>
              <div className="form-row">
                <label htmlFor="value_unit">Ед. изм:</label>
                <input
                id="value_unit"
                type="text"
                value={physical_properties.specific_heat?.value_unit ?? ""}
                className="input"
                onChange={(event) => {
                const text = event.target.value;
              }}
            />
          </div>
          <div className="form-row">
            <label htmlFor="comment">Комментарий:</label>
            <input
              id="comment"
              type="text"
              value={physical_properties.specific_heat?.comment ?? ""}
              className="input"
              onChange={(event) => {
                const text = event.target.value;}}
            />
        </div>
      </fieldset>
      </div>
    </form>
  )
}