from pydantic import BaseModel, field_validator
from datetime import date


# What React sends us to create an item
class ItemCreate(BaseModel):
    name: str
    cat: str
    price: float
    qty: str
    expiry: date

    @field_validator("price")
    @classmethod
    def price_must_be_positive(cls, v):
        if v < 0:
            raise ValueError("Price must be a non-negative number")
        return v

    @field_validator("name")
    @classmethod
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("Name must not be empty")
        return v.strip()

    @field_validator("qty")
    @classmethod
    def qty_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("Quantity must not be empty")
        return v.strip()


# What we send back to React (includes the database ID)
class ItemResponse(ItemCreate):
    id: int

    class Config:
        from_attributes = True