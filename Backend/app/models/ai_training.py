from sqlalchemy import Column, Integer, String
from app.database import Base


class AITraining(Base):

    __tablename__ = "ai_training"

    id = Column(Integer, primary_key=True, index=True)

    keyword = Column(String)

    unit_no = Column(String)

    owner_name = Column(String, nullable=True)

    category = Column(String)