from sqlalchemy import Column, Integer, String
from app.database import Base

class Member(Base):

    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)

    unit_no = Column(String, unique=True, nullable=False)

    unit_type = Column(String)

    new_owner = Column(String)

    old_owner = Column(String)

    carpet_area = Column(String)

    mobile = Column(String)

    email = Column(String)

    status = Column(String, default="Active")
    
   
 