from sqlalchemy import Column, Integer, String, Float, Date
from .Kdatabase import Base

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    cat = Column(String)  # Category (e.g., Grains, Dairy)
    price = Column(Float)
    qty = Column(String)
    expiry = Column(Date)