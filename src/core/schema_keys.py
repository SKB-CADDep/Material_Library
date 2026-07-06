class Schema:
    """Константы для ключей JSON структуры материала."""
    METADATA = "metadata"
    PHYSICAL = "physical_properties"
    MECHANICAL = "mechanical_properties"
    CHEMICAL = "chemical_properties"

    # Вложенные ключи
    STRENGTH_CAT = "strength_category"
    COMPOSITION = "composition"
    TEMP_PAIRS = "temperature_value_pairs"
    APP_AREA = "application_area"
    NAME_STD = "name_material_standard"
    NAME_ALT = "name_material_alternative"

    # Поля значений
    REF_ID = "source_ref_id"
    VAL_STR_CAT = "value_strength_category"