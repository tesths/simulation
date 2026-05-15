from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

TIME_POINTS = (2, 4, 6, 8, 10, 12, 14)
SERIES_META = (
    ("cool", "凉水温度", "#2563eb"),
    ("hot", "热水温度", "#ef4444"),
)
Y_AXIS_RANGE = {"min": 0, "max": 100}


class RecordSubmission(BaseModel):
    record_date: date
    cool_2: float = Field(..., ge=0, le=100)
    hot_2: float = Field(..., ge=0, le=100)
    cool_4: float = Field(..., ge=0, le=100)
    hot_4: float = Field(..., ge=0, le=100)
    cool_6: float = Field(..., ge=0, le=100)
    hot_6: float = Field(..., ge=0, le=100)
    cool_8: float = Field(..., ge=0, le=100)
    hot_8: float = Field(..., ge=0, le=100)
    cool_10: float = Field(..., ge=0, le=100)
    hot_10: float = Field(..., ge=0, le=100)
    cool_12: float = Field(..., ge=0, le=100)
    hot_12: float = Field(..., ge=0, le=100)
    cool_14: float = Field(..., ge=0, le=100)
    hot_14: float = Field(..., ge=0, le=100)

    def value_map(self) -> dict[str, float]:
        return {
            field_name: float(getattr(self, field_name))
            for field_name in type(self).model_fields
            if field_name != "record_date"
        }


class ChartSeries(BaseModel):
    key: str
    name: str
    color: str
    values: list[float]


class ChartPayload(BaseModel):
    group_id: int
    group_name: str
    record_date: str | None
    labels: list[int]
    y_axis: dict[str, int]
    has_data: bool
    series: list[ChartSeries]


def empty_chart_payload(group_id: int, group_name: str) -> ChartPayload:
    return ChartPayload(
        group_id=group_id,
        group_name=group_name,
        record_date=None,
        labels=list(TIME_POINTS),
        y_axis=Y_AXIS_RANGE,
        has_data=False,
        series=[
            ChartSeries(key=key, name=name, color=color, values=[])
            for key, name, color in SERIES_META
        ],
    )


def chart_payload_from_record(
    group_id: int,
    group_name: str,
    record_date: str,
    values: dict[str, float],
) -> ChartPayload:
    return ChartPayload(
        group_id=group_id,
        group_name=group_name,
        record_date=record_date,
        labels=list(TIME_POINTS),
        y_axis=Y_AXIS_RANGE,
        has_data=True,
        series=[
            ChartSeries(
                key=key,
                name=name,
                color=color,
                values=[float(values[f"{key}_{point}"]) for point in TIME_POINTS],
            )
            for key, name, color in SERIES_META
        ],
    )
